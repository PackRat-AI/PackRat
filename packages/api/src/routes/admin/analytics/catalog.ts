import { createDb } from '@packrat/api/db';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { CatalogEtlWorkflowParams } from '@packrat/api/workflows/catalog-etl-workflow';
import { type ChunkSpec, chunkCsvForR2 } from '@packrat/api/workflows/shared/chunkCsvForR2';
import { catalogItems, etlJobs, invalidItemLogs } from '@packrat/db';
import {
  AdminErrorResponses,
  BrandRowSchema,
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
    async ({ params }) => {
      const db = createDb();

      try {
        const [original] = await db
          .select()
          .from(etlJobs)
          .where(eq(etlJobs.id, params.jobId))
          .limit(1);

        if (!original) return status(404, { error: 'ETL job not found' });
        if (original.status !== 'failed')
          return status(409, {
            error:
              original.status === 'running'
                ? 'Job is still running — wait for it to complete or reset stuck jobs first'
                : 'Only failed jobs can be retried',
          });

        const newJobId = crypto.randomUUID();
        const objectKey = `v2/${original.source}/${original.filename}`;
        const env = getEnv();

        if (!env.ETL_WORKFLOW) return status(400, { error: 'ETL_WORKFLOW is not configured' });

        const r2 = new R2BucketService({ env, bucketType: 'catalog' });
        const { chunks } = await chunkCsvForR2({ r2, objectKey });
        const totalChunks = chunks.length;
        const indexedChunks: ChunkSpec[] = chunks.map((c, i) => ({
          ...c,
          chunkIndex: i,
          chunksTotal: totalChunks,
        }));

        // Suffix the instance ID with the new jobId so duplicate retries
        // don't collide with the original instance or with each other.
        const workflowInstanceId = `${original.source}-${original.filename}-retry-${newJobId}`;

        await db.insert(etlJobs).values({
          id: newJobId,
          status: 'running',
          source: original.source,
          filename: original.filename,
          scraperRevision: original.scraperRevision,
          startedAt: new Date(),
          workflowInstanceId,
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

        return { success: true as const, newJobId, objectKey, workflowInstanceId };
      } catch (error) {
        console.error('ETL retry error:', error);
        return status(500, { error: 'Failed to retry ETL job', code: 'ETL_RETRY_ERROR' });
      }
    },
    {
      params: z.object({ jobId: z.string().uuid() }),
      response: { 200: EtlRetrySchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Retry a failed ETL job via the workflow path' },
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
  );
