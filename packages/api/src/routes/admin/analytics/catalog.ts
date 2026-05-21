import { createDb } from '@packrat/api/db';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { CatalogEtlWorkflowParams } from '@packrat/api/workflows/catalog-etl-workflow';
import { type ChunkSpec, chunkCsvForR2 } from '@packrat/api/workflows/shared/chunkCsvForR2';
import { catalogItems, etlJobs, invalidItemLogs } from '@packrat/db';
import {
  AdminErrorResponses,
  BrandRowSchema,
  CatalogAuditSchema,
  CatalogOverviewSchema,
  EtlFailureSummarySchema,
  EtlJobFailuresSchema,
  EtlReconcileSchema,
  EtlResetStuckSchema,
  EtlResponseSchema,
  EtlRetrySchema,
  PriceBucketSchema,
} from '@packrat/schemas/admin';
import { parse } from 'csv-parse';
import { and, avg, count, desc, eq, gt, isNotNull, lt, max, min, sql } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

type ReingestResult =
  | {
      success: true;
      newJobId: string;
      objectKey: string;
      workflowInstanceId: string;
    }
  | {
      _statusCode: 400 | 404 | 409 | 500;
      error: string;
      code?: string;
    };

/**
 * Shared body for retry + repair-from-scratch admin endpoints.
 *
 * mode:
 *   - 'retry'  — only `status='failed'` jobs are eligible (defensive).
 *   - 'repair' — any job is eligible; always sets supersededByJobId.
 *
 * force=true skips the etag fail-closed check. Use when:
 *   - The original job has no source_etag (legacy queue-era rows, or the
 *     2026-05-14 false-failure rows).
 *   - The operator has manually verified the R2 source content.
 */
async function reingestJob(args: {
  originalJobId: string;
  mode: 'retry' | 'repair';
  force: boolean;
}): Promise<ReingestResult> {
  const { originalJobId, mode, force } = args;
  const db = createDb();

  try {
    const [original] = await db
      .select()
      .from(etlJobs)
      .where(eq(etlJobs.id, originalJobId))
      .limit(1);

    if (!original) {
      return { _statusCode: 404, error: 'ETL job not found' };
    }

    if (mode === 'retry' && original.status !== 'failed') {
      return {
        _statusCode: 409,
        error:
          original.status === 'running'
            ? 'Job is still running — wait for it to complete or use repair-from-scratch'
            : 'Only failed jobs can be retried — use repair-from-scratch for completed jobs',
      };
    }

    if (mode === 'repair' && original.status === 'running') {
      return {
        _statusCode: 409,
        error: 'Job is still running — wait for it to complete before repair',
      };
    }

    const newJobId = crypto.randomUUID();
    const objectKey = `v2/${original.source}/${original.filename}`;
    const env = getEnv();

    if (!env.ETL_WORKFLOW) {
      return { _statusCode: 400, error: 'ETL_WORKFLOW is not configured' };
    }

    const r2 = new R2BucketService({ env, bucketType: 'catalog' });
    const head = await r2.head(objectKey);
    if (!head) {
      return { _statusCode: 404, error: `R2 source not found at ${objectKey}` };
    }

    // ETag fail-closed: if we have a stored etag and the live etag has
    // drifted, refuse unless the operator explicitly forces. This is the
    // guard that stops a scraper overwrite from being silently re-applied
    // to an old (source, filename) under the wrong audit record.
    if (!force && original.sourceEtag !== null && original.sourceEtag !== head.etag) {
      return {
        _statusCode: 409,
        error:
          `R2 source etag has drifted (stored=${original.sourceEtag}, ` +
          `live=${head.etag}). Pass ?force=true to re-ingest the current content.`,
        code: 'ETL_ETAG_MISMATCH',
      };
    }

    const {
      etag: liveEtag,
      lastModified: liveLastModified,
      chunks,
    } = await chunkCsvForR2({
      r2,
      objectKey,
    });
    const totalChunks = chunks.length;
    const indexedChunks: ChunkSpec[] = chunks.map((c, i) => ({
      ...c,
      chunkIndex: i,
      chunksTotal: totalChunks,
    }));

    // Suffix the instance ID with the new jobId so duplicate retries
    // don't collide with the original instance or with each other.
    const suffix = mode === 'retry' ? 'retry' : 'repair';
    const workflowInstanceId = `${original.source}-${original.filename}-${suffix}-${newJobId}`;

    await db.insert(etlJobs).values({
      id: newJobId,
      status: 'running',
      source: original.source,
      filename: original.filename,
      scraperRevision: original.scraperRevision,
      startedAt: new Date(),
      workflowInstanceId,
      sourceEtag: liveEtag,
      sourceLastModified: liveLastModified,
      supersededByJobId: originalJobId,
      supersededAt: new Date(),
    });

    const workflowParams: CatalogEtlWorkflowParams = {
      jobId: newJobId,
      source: original.source,
      scraperRevision: original.scraperRevision,
      chunks: indexedChunks,
    };

    try {
      await env.ETL_WORKFLOW.create({ id: workflowInstanceId, params: workflowParams });
    } catch (enqueueErr) {
      await db
        .update(etlJobs)
        .set({ status: 'failed', completedAt: new Date() })
        .where(eq(etlJobs.id, newJobId));
      throw enqueueErr;
    }

    return { success: true, newJobId, objectKey, workflowInstanceId };
  } catch (error) {
    console.error(`ETL ${mode} error:`, error);
    return {
      _statusCode: 500,
      error: `Failed to ${mode === 'retry' ? 'retry' : 'repair'} ETL job`,
      code: mode === 'retry' ? 'ETL_RETRY_ERROR' : 'ETL_REPAIR_ERROR',
    };
  }
}

export const catalogAnalyticsRoutes = new Elysia({ prefix: '/catalog' })
  .get(
    '/overview',
    async () => {
      const db = createDb();

      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [totals, embeddingStats, availabilityStats, recentCount] = await Promise.all([
          db
            .select({
              totalItems: count(),
              totalBrands: sql<number>`count(distinct ${catalogItems.brand})`,
              avgPrice: avg(catalogItems.price),
              minPrice: min(catalogItems.price),
              maxPrice: max(catalogItems.price),
            })
            .from(catalogItems),
          db
            .select({
              total: count(),
              withEmbedding: sql<number>`count(${catalogItems.embedding})`,
            })
            .from(catalogItems),
          db
            .select({ status: catalogItems.availability, count: count() })
            .from(catalogItems)
            .groupBy(catalogItems.availability)
            .orderBy(desc(count())),
          db
            .select({ count: count() })
            .from(catalogItems)
            .where(gt(catalogItems.createdAt, thirtyDaysAgo)),
        ]);

        const t = totals[0];
        const e = embeddingStats[0];
        if (!t || !e) {
          return status(500, {
            error: 'Failed to fetch catalog overview',
            code: 'CATALOG_OVERVIEW_ERROR',
          });
        }

        return {
          totalItems: t.totalItems,
          totalBrands: Number(t.totalBrands),
          avgPrice: t.avgPrice != null ? Math.round(Number(t.avgPrice) * 100) / 100 : null,
          minPrice: t.minPrice != null ? Number(t.minPrice) : null,
          maxPrice: t.maxPrice != null ? Number(t.maxPrice) : null,
          embeddingCoverage: {
            total: e.total,
            withEmbedding: Number(e.withEmbedding),
            pct: e.total > 0 ? Math.round((Number(e.withEmbedding) / e.total) * 1000) / 10 : 0,
          },
          availability: availabilityStats.map((r) => ({
            status: r.status ?? null,
            count: r.count,
          })),
          addedLast30Days: recentCount[0]?.count ?? 0,
        };
      } catch (error) {
        console.error('Catalog overview error:', error);
        return status(500, {
          error: 'Failed to fetch catalog overview',
          code: 'CATALOG_OVERVIEW_ERROR',
        });
      }
    },
    {
      response: { 200: CatalogOverviewSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Catalog data lake overview' },
    },
  )

  .get(
    '/brands',
    async ({ query }) => {
      const db = createDb();
      const { limit = 25 } = query;

      try {
        const brands = await db
          .select({
            brand: catalogItems.brand,
            itemCount: count(),
            avgPrice: avg(catalogItems.price),
            minPrice: min(catalogItems.price),
            maxPrice: max(catalogItems.price),
            avgRating: avg(catalogItems.ratingValue),
          })
          .from(catalogItems)
          .where(isNotNull(catalogItems.brand))
          .groupBy(catalogItems.brand)
          .orderBy(desc(count()))
          .limit(limit);

        return brands.map((b) => ({
          brand: b.brand ?? '',
          itemCount: b.itemCount,
          avgPrice: b.avgPrice != null ? Math.round(Number(b.avgPrice) * 100) / 100 : null,
          minPrice: b.minPrice != null ? Number(b.minPrice) : null,
          maxPrice: b.maxPrice != null ? Number(b.maxPrice) : null,
          avgRating: b.avgRating != null ? Math.round(Number(b.avgRating) * 10) / 10 : null,
        }));
      } catch (error) {
        console.error('Catalog brands error:', error);
        return status(500, { error: 'Failed to fetch brand data', code: 'CATALOG_BRANDS_ERROR' });
      }
    },
    {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      response: { 200: z.array(BrandRowSchema), ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Top gear brands' },
    },
  )

  .get(
    '/prices',
    async () => {
      const db = createDb();

      try {
        const bucketExpr = sql<string>`CASE
          WHEN ${catalogItems.price} < 20   THEN 'Under $20'
          WHEN ${catalogItems.price} < 50   THEN '$20–$50'
          WHEN ${catalogItems.price} < 100  THEN '$50–$100'
          WHEN ${catalogItems.price} < 200  THEN '$100–$200'
          WHEN ${catalogItems.price} < 500  THEN '$200–$500'
          ELSE 'Over $500'
        END`;

        const distribution = await db
          .select({ bucket: bucketExpr, count: count(), minForOrder: min(catalogItems.price) })
          .from(catalogItems)
          .where(and(isNotNull(catalogItems.price), gt(catalogItems.price, 0)))
          .groupBy(bucketExpr)
          .orderBy(min(catalogItems.price));

        return distribution.map((r) => ({ bucket: r.bucket, count: r.count }));
      } catch (error) {
        console.error('Catalog prices error:', error);
        return status(500, {
          error: 'Failed to fetch price distribution',
          code: 'CATALOG_PRICES_ERROR',
        });
      }
    },
    {
      response: { 200: z.array(PriceBucketSchema), ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Price distribution' },
    },
  )

  .get(
    '/etl',
    async ({ query }) => {
      const db = createDb();
      const { limit = 50 } = query;

      try {
        const [jobs, summary] = await Promise.all([
          db.select().from(etlJobs).orderBy(desc(etlJobs.startedAt)).limit(limit),
          db
            .select({
              totalRuns: count(),
              completed: sql<number>`count(*) filter (where ${etlJobs.status} = 'completed')`,
              failed: sql<number>`count(*) filter (where ${etlJobs.status} = 'failed')`,
              totalItemsIngested: sql<number>`coalesce(sum(${etlJobs.totalValid}), 0)`,
            })
            .from(etlJobs),
        ]);

        const s = summary[0];

        return {
          jobs: jobs.map((j) => ({
            id: j.id,
            status: j.status,
            source: j.source,
            filename: j.filename,
            scraperRevision: j.scraperRevision,
            startedAt: j.startedAt.toISOString(),
            completedAt: j.completedAt?.toISOString() ?? null,
            totalProcessed: j.totalProcessed ?? null,
            totalValid: j.totalValid ?? null,
            totalInvalid: j.totalInvalid ?? null,
            successRate:
              j.totalProcessed != null && j.totalProcessed > 0 && j.totalValid != null
                ? Math.round((j.totalValid / j.totalProcessed) * 1000) / 10
                : null,
          })),
          summary: {
            totalRuns: s?.totalRuns ?? 0,
            completed: Number(s?.completed ?? 0),
            failed: Number(s?.failed ?? 0),
            totalItemsIngested: Number(s?.totalItemsIngested ?? 0),
          },
        };
      } catch (error) {
        console.error('Catalog ETL error:', error);
        return status(500, { error: 'Failed to fetch ETL history', code: 'CATALOG_ETL_ERROR' });
      }
    },
    {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(200).optional(),
      }),
      response: { 200: EtlResponseSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'ETL pipeline history' },
    },
  )

  .get(
    '/embeddings',
    async () => {
      const db = createDb();

      try {
        const [total, withEmbedding] = await Promise.all([
          db.select({ count: count() }).from(catalogItems),
          db.select({ count: count() }).from(catalogItems).where(isNotNull(catalogItems.embedding)),
        ]);

        const totalCount = total[0]?.count ?? 0;
        const embeddedCount = withEmbedding[0]?.count ?? 0;

        return {
          total: totalCount,
          withEmbedding: embeddedCount,
          pending: totalCount - embeddedCount,
          coveragePct: totalCount > 0 ? Math.round((embeddedCount / totalCount) * 1000) / 10 : 0,
        };
      } catch (error) {
        console.error('Catalog embeddings error:', error);
        return status(500, {
          error: 'Failed to fetch embedding stats',
          code: 'CATALOG_EMBEDDINGS_ERROR',
        });
      }
    },
    { detail: { tags: ['Admin'], summary: 'Embedding coverage' } },
  )

  // ─── ETL failure summary ──────────────────────────────────────────────────────

  .get(
    '/etl/failure-summary',
    async ({ query }) => {
      const db = createDb();
      const { limit = 20 } = query;

      try {
        const [rows, [total]] = await Promise.all([
          db.execute<{ field: string; reason: string; count: number }>(
            sql`
              SELECT
                err->>'field'  AS field,
                err->>'reason' AS reason,
                COUNT(*)::int  AS count
              FROM ${invalidItemLogs},
                   jsonb_array_elements(${invalidItemLogs.errors}) AS err
              GROUP BY err->>'field', err->>'reason'
              ORDER BY count DESC
              LIMIT ${limit}
            `,
          ),
          db.select({ n: count() }).from(invalidItemLogs),
        ]);

        return {
          topErrors: rows.rows.map((r) => ({
            field: r.field,
            reason: r.reason,
            count: r.count,
          })),
          totalInvalidItems: total?.n ?? 0,
        };
      } catch (error) {
        console.error('ETL failure summary error:', error);
        return status(500, {
          error: 'Failed to fetch failure summary',
          code: 'ETL_FAILURE_SUMMARY_ERROR',
        });
      }
    },
    {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      response: { 200: EtlFailureSummarySchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Top ETL validation failure patterns' },
    },
  )

  // ─── Per-job failure drill-down ───────────────────────────────────────────────

  .get(
    '/etl/:jobId/failures',
    async ({ params, query }) => {
      const db = createDb();
      const { limit = 50 } = query;

      try {
        const [samples, breakdown] = await Promise.all([
          db
            .select()
            .from(invalidItemLogs)
            .where(eq(invalidItemLogs.jobId, params.jobId))
            .orderBy(invalidItemLogs.rowIndex)
            .limit(limit),
          db.execute<{ field: string; reason: string; count: number }>(
            sql`
              SELECT
                err->>'field'  AS field,
                err->>'reason' AS reason,
                COUNT(*)::int  AS count
              FROM ${invalidItemLogs},
                   jsonb_array_elements(${invalidItemLogs.errors}) AS err
              WHERE ${invalidItemLogs.jobId} = ${params.jobId}
              GROUP BY err->>'field', err->>'reason'
              ORDER BY count DESC
            `,
          ),
        ]);

        return {
          jobId: params.jobId,
          errorBreakdown: breakdown.rows.map((r) => ({
            field: r.field,
            reason: r.reason,
            count: r.count,
          })),
          samples: samples.map((s) => ({
            rowIndex: s.rowIndex,
            errors: s.errors,
            rawData: s.rawData,
          })),
          totalShown: samples.length,
        };
      } catch (error) {
        console.error('ETL job failures error:', error);
        return status(500, {
          error: 'Failed to fetch job failures',
          code: 'ETL_JOB_FAILURES_ERROR',
        });
      }
    },
    {
      params: z.object({ jobId: z.string().uuid() }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(200).optional(),
      }),
      response: { 200: EtlJobFailuresSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Validation failures for a specific ETL job' },
    },
  )

  // ─── Reset stuck jobs ─────────────────────────────────────────────────────────

  .post(
    '/etl/reset-stuck',
    async () => {
      const db = createDb();

      try {
        // Jobs stuck in 'running' for more than 30 minutes are considered stalled
        const stuckCutoff = new Date(Date.now() - 30 * 60 * 1000);

        const reset = await db
          .update(etlJobs)
          .set({ status: 'failed', completedAt: new Date() })
          .where(and(eq(etlJobs.status, 'running'), lt(etlJobs.startedAt, stuckCutoff)))
          .returning();

        return { reset: reset.length, ids: reset.map((r) => r.id) };
      } catch (error) {
        console.error('ETL reset stuck error:', error);
        return status(500, { error: 'Failed to reset stuck jobs', code: 'ETL_RESET_STUCK_ERROR' });
      }
    },
    {
      response: { 200: EtlResetStuckSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Mark stuck running ETL jobs as failed' },
    },
  )

  // ─── Retry a failed job ───────────────────────────────────────────────────────
  //
  // Re-ingests via the workflow path regardless of the original engine.
  // Works for both legacy queue-era failures and workflow-era failures —
  // the new instance carries chunks computed by chunkCsvForR2 so the
  // re-ingest is row-boundary-aligned.

  .post(
    '/etl/:jobId/retry',
    async ({ params, query }) => {
      const result = await reingestJob({
        originalJobId: params.jobId,
        mode: 'retry',
        force: query.force === true,
      });
      if ('_statusCode' in result) {
        const { _statusCode, ...body } = result;
        return status(_statusCode, body);
      }
      return result;
    },
    {
      params: z.object({ jobId: z.string().uuid() }),
      query: z.object({ force: z.coerce.boolean().optional() }),
      response: { 200: EtlRetrySchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Retry a failed ETL job via the workflow path' },
    },
  )

  // ─── Repair-from-scratch (works on completed jobs too) ──────────────────────
  //
  // Same shape as retry but accepts `completed` jobs — for cases where an
  // operator suspects the original ingest under-counted (e.g., the
  // 2026-05-14 false-failures whose counters might be wrong even after
  // status was correctly `completed`). Always sets superseded_by_job_id
  // for full audit trail.

  .post(
    '/etl/:jobId/repair-from-scratch',
    async ({ params, query }) => {
      const result = await reingestJob({
        originalJobId: params.jobId,
        mode: 'repair',
        force: query.force === true,
      });
      if ('_statusCode' in result) {
        const { _statusCode, ...body } = result;
        return status(_statusCode, body);
      }
      return result;
    },
    {
      params: z.object({ jobId: z.string().uuid() }),
      query: z.object({ force: z.coerce.boolean().optional() }),
      response: { 200: EtlRetrySchema, ...AdminErrorResponses },
      detail: {
        tags: ['Admin'],
        summary:
          'Re-ingest a job from scratch via the workflow path (works on completed jobs; always supersedes)',
      },
    },
  )

  // ─── Reconcile a job's row count against its R2 source ───────────────────────
  //
  // Synchronous — counts logical CSV rows (csv-parse, not raw \n counting
  // since quoted multi-line fields skew that) and persists the result on
  // etl_jobs.verified_at + verified_row_count. For very large files this
  // can be slow; an async-via-workflow path is a follow-up if needed.

  .post(
    '/etl/:jobId/reconcile',
    async ({ params }) => {
      const db = createDb();

      try {
        const [job] = await db.select().from(etlJobs).where(eq(etlJobs.id, params.jobId)).limit(1);

        if (!job) return status(404, { error: 'ETL job not found' });

        const objectKey = `v2/${job.source}/${job.filename}`;
        const env = getEnv();
        const r2 = new R2BucketService({ env, bucketType: 'catalog' });
        const obj = await r2.get(objectKey);
        if (!obj) return status(404, { error: `R2 source not found at ${objectKey}` });

        const parser = parse({ relax_column_count: true, skip_empty_lines: true });
        let totalRows = 0;
        let isHeaderProcessed = false;

        const writerPromise = (async () => {
          const reader = obj.body.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const ok = parser.write(decoder.decode(value, { stream: true }));
              if (!ok) {
                await new Promise<void>((resolve) => parser.once('drain', resolve));
              }
            }
          } finally {
            reader.releaseLock();
            parser.end();
          }
        })().catch((err) => {
          parser.destroy(err instanceof Error ? err : new Error(String(err)));
          throw err;
        });

        for await (const _record of parser) {
          if (!isHeaderProcessed) {
            isHeaderProcessed = true;
            continue;
          }
          totalRows++;
        }

        await writerPromise;

        const expectedRowCount = totalRows;
        const actualRowCount = job.totalProcessed;
        const delta = actualRowCount === null ? null : expectedRowCount - actualRowCount;

        await db
          .update(etlJobs)
          .set({
            verifiedAt: new Date(),
            verifiedRowCount: expectedRowCount,
          })
          .where(eq(etlJobs.id, params.jobId));

        return {
          success: true as const,
          jobId: params.jobId,
          expectedRowCount,
          actualRowCount,
          delta,
        };
      } catch (error) {
        console.error('ETL reconcile error:', error);
        return status(500, {
          error: 'Failed to reconcile ETL job',
          code: 'ETL_RECONCILE_ERROR',
        });
      }
    },
    {
      params: z.object({ jobId: z.string().uuid() }),
      response: { 200: EtlReconcileSchema, ...AdminErrorResponses },
      detail: {
        tags: ['Admin'],
        summary: 'Count R2 source rows and persist verified_row_count on etl_jobs',
      },
    },
  )

  // ─── Catalog data-quality audit ────────────────────────────────────────────
  //
  // Per-source breakdown of catalog_items quality flags. Powers the scrapyd
  // audit_db_catalog.py script so that scrapyd never needs DB credentials —
  // it consumes the JSON from this endpoint and renders markdown.
  //
  // Flags surfaced (computed server-side from threshold constants):
  //   decimal_bug — count of prices < $10 with 3+ decimal places
  //   low_median — median price below $20 for a non-allowlisted source
  //   high_null:<field> — > 30% NULL rate on a key field
  //   bad_weight — count of weights < 1g or > 100kg
  //   empty_name — count of empty/null names
  //   stale — source has no completed ETL in 30+ days
  //
  // ?source=<name> filters to one source (faster + scoped). Omit for all sources.

  .get(
    '/etl/audit',
    async ({ query }) => {
      const db = createDb();

      try {
        const sourceFilter = query.source;

        // Single GROUP BY query. catalog_item_etl_jobs is the per-item-per-job
        // join; we attribute each catalog item to its most recent ingest source
        // via DISTINCT ON. Then aggregate per source.
        const rows = (await db.execute(sql`
          WITH latest_per_item AS (
            SELECT DISTINCT ON (cie.catalog_item_id)
              cie.catalog_item_id,
              j.source
            FROM catalog_item_etl_jobs cie
            JOIN etl_jobs j ON j.id = cie.etl_job_id
            ORDER BY cie.catalog_item_id, cie.created_at DESC
          ),
          last_jobs AS (
            SELECT DISTINCT ON (source)
              source,
              id AS last_id,
              completed_at AS last_at
            FROM etl_jobs
            WHERE status = 'completed'
            ORDER BY source, completed_at DESC NULLS LAST
          )
          SELECT
            lpi.source,
            COUNT(*)::int AS total_items,
            lj.last_id,
            lj.last_at,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY ci.price)::float AS median_price,
            MIN(ci.price) FILTER (WHERE ci.price > 0)::float AS min_price,
            MAX(ci.price)::float AS max_price,
            COUNT(*) FILTER (WHERE ci.price IS NULL)::int AS null_price,
            COUNT(*) FILTER (WHERE ci.brand IS NULL OR ci.brand = '')::int AS null_brand,
            COUNT(*) FILTER (WHERE ci.description IS NULL OR ci.description = '')::int AS null_desc,
            COUNT(*) FILTER (WHERE ci.weight IS NULL)::int AS null_weight,
            COUNT(*) FILTER (
              WHERE ci.images IS NULL OR jsonb_array_length(ci.images) = 0
            )::int AS null_images,
            COUNT(*) FILTER (WHERE ci.availability IS NULL)::int AS null_avail,
            COUNT(*) FILTER (WHERE ci.name IS NULL OR ci.name = '')::int AS empty_name,
            COUNT(*) FILTER (
              WHERE ci.price IS NOT NULL
                AND ci.price < 10
                AND ci.price <> floor(ci.price)
                AND (ci.price * 1000) = floor(ci.price * 1000)
            )::int AS suspicious_decimal,
            COUNT(*) FILTER (
              WHERE ci.weight IS NOT NULL
                AND (ci.weight < 1 OR ci.weight > 100000)
            )::int AS suspicious_weight
          FROM latest_per_item lpi
          JOIN catalog_items ci ON ci.id = lpi.catalog_item_id
          LEFT JOIN last_jobs lj ON lj.source = lpi.source
          ${sourceFilter ? sql`WHERE lpi.source = ${sourceFilter}` : sql``}
          GROUP BY lpi.source, lj.last_id, lj.last_at
          ORDER BY lpi.source
        `)) as unknown as Array<{
          source: string;
          total_items: number;
          last_id: string | null;
          last_at: Date | null;
          median_price: number | null;
          min_price: number | null;
          max_price: number | null;
          null_price: number;
          null_brand: number;
          null_desc: number;
          null_weight: number;
          null_images: number;
          null_avail: number;
          empty_name: number;
          suspicious_decimal: number;
          suspicious_weight: number;
        }>;

        const now = Date.now();
        // Sources with no median price below this for non-allowlisted sources flag low_median.
        // Allowlist matches the EXPECTED_LOW_PRICE_SOURCES constant in scrapyd's
        // audit_r2_data.py — kept in sync manually for now.
        const expectedLowPriceSources = new Set([
          '3vgear',
          'bioliteenergy',
          'farmtofeet',
          'kelty',
          'darntough',
        ]);
        const minFillRate = 0.7;

        const sources = rows.map((r) => {
          const daysStale =
            r.last_at !== null
              ? Math.floor((now - new Date(r.last_at).getTime()) / (24 * 60 * 60 * 1000))
              : null;
          const total = r.total_items;
          const nullRates = {
            price: total > 0 ? r.null_price / total : 0,
            brand: total > 0 ? r.null_brand / total : 0,
            description: total > 0 ? r.null_desc / total : 0,
            weight: total > 0 ? r.null_weight / total : 0,
            images: total > 0 ? r.null_images / total : 0,
            availability: total > 0 ? r.null_avail / total : 0,
          };
          const flags: string[] = [];
          if (r.suspicious_decimal > 0) flags.push(`decimal_bug (${r.suspicious_decimal})`);
          if (
            r.median_price !== null &&
            r.median_price < 20 &&
            !expectedLowPriceSources.has(r.source)
          ) {
            flags.push(`low_median ($${r.median_price.toFixed(2)})`);
          }
          for (const [field, rate] of Object.entries(nullRates)) {
            if (rate > 1 - minFillRate) {
              flags.push(`high_null:${field} (${Math.round(rate * 100)}%)`);
            }
          }
          if (r.suspicious_weight > 0) flags.push(`bad_weight (${r.suspicious_weight})`);
          if (r.empty_name > 0) flags.push(`empty_name (${r.empty_name})`);
          if (daysStale !== null && daysStale > 30) flags.push(`stale (${daysStale}d)`);

          return {
            source: r.source,
            totalItems: total,
            lastEtlId: r.last_id,
            lastEtlAt: r.last_at ? new Date(r.last_at).toISOString() : null,
            daysStale,
            medianPrice: r.median_price,
            minPrice: r.min_price,
            maxPrice: r.max_price,
            nullRates,
            suspiciousDecimalCount: r.suspicious_decimal,
            suspiciousWeightCount: r.suspicious_weight,
            emptyNameCount: r.empty_name,
            flags,
          };
        });

        return {
          generatedAt: new Date().toISOString(),
          thresholds: {
            decimalBugPriceThreshold: 10,
            lowMedianPriceThreshold: 20,
            minFillRate,
            staleDaysThreshold: 30,
            weightTooLightGrams: 1,
            weightTooHeavyGrams: 100000,
          },
          sources,
        };
      } catch (error) {
        console.error('Catalog audit error:', error);
        return status(500, { error: 'Failed to generate catalog audit', code: 'AUDIT_ERROR' });
      }
    },
    {
      query: z.object({ source: z.string().optional() }),
      response: { 200: CatalogAuditSchema, ...AdminErrorResponses },
      detail: {
        tags: ['Admin'],
        summary:
          'Per-source catalog_items data-quality audit (decimal bugs, NULL rates, staleness)',
      },
    },
  );
