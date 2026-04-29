import { createDb } from '@packrat/api/db';
import { catalogItems, etlJobs } from '@packrat/api/db/schema';
import { and, avg, count, desc, gt, isNotNull, max, min, sql } from 'drizzle-orm';
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
          totalBrands: t.totalBrands,
          avgPrice: t.avgPrice != null ? Math.round(Number(t.avgPrice) * 100) / 100 : null,
          minPrice: t.minPrice != null ? Number(t.minPrice) : null,
          maxPrice: t.maxPrice != null ? Number(t.maxPrice) : null,
          embeddingCoverage: {
            total: e.total,
            withEmbedding: e.withEmbedding,
            pct: e.total > 0 ? Math.round((e.withEmbedding / e.total) * 1000) / 10 : 0,
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
    { detail: { tags: ['Admin'], summary: 'Catalog data lake overview' } },
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
        limit: z.coerce.number().int().min(1).max(100).optional().default(25),
      }),
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
    { detail: { tags: ['Admin'], summary: 'Price distribution' } },
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
            completed: s?.completed ?? 0,
            failed: s?.failed ?? 0,
            totalItemsIngested: s?.totalItemsIngested ?? 0,
          },
        };
      } catch (error) {
        console.error('Catalog ETL error:', error);
        return status(500, { error: 'Failed to fetch ETL history', code: 'CATALOG_ETL_ERROR' });
      }
    },
    {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(200).optional().default(50),
      }),
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
  );
