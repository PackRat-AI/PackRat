import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems, etlJobs } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import { and, avg, count, desc, gt, isNotNull, max, min, sql } from 'drizzle-orm';
import { z } from 'zod';

export const catalogRoutes = new OpenAPIHono<{ Bindings: Env }>();

// ─── GET /overview ──────────────────────────────────────────────────────────

const getOverviewRoute = createRoute({
  method: 'get',
  path: '/overview',
  tags: ['Admin'],
  summary: 'Catalog data lake overview',
  description: 'Aggregate statistics across the gear catalog — totals, pricing, availability, and embedding coverage (Admin only)',
  responses: {
    200: {
      description: 'Catalog overview',
      content: {
        'application/json': {
          schema: z.object({
            totalItems: z.number(),
            totalBrands: z.number(),
            avgPrice: z.number().nullable(),
            minPrice: z.number().nullable(),
            maxPrice: z.number().nullable(),
            embeddingCoverage: z.object({
              total: z.number(),
              withEmbedding: z.number(),
              pct: z.number(),
            }),
            availability: z.array(z.object({
              status: z.string().nullable(),
              count: z.number(),
            })),
            addedLast30Days: z.number(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

catalogRoutes.openapi(getOverviewRoute, async (c) => {
  const db = createDb(c);

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
        .select({
          status: catalogItems.availability,
          count: count(),
        })
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
      return c.json({ error: 'Failed to fetch catalog overview', code: 'CATALOG_OVERVIEW_ERROR' }, 500);
    }

    const total = e.total;
    const withEmbedding = e.withEmbedding;

    return c.json(
      {
        totalItems: t.totalItems,
        totalBrands: t.totalBrands,
        avgPrice: t.avgPrice != null ? Math.round(Number(t.avgPrice) * 100) / 100 : null,
        minPrice: t.minPrice != null ? Number(t.minPrice) : null,
        maxPrice: t.maxPrice != null ? Number(t.maxPrice) : null,
        embeddingCoverage: {
          total,
          withEmbedding,
          pct: total > 0 ? Math.round((withEmbedding / total) * 1000) / 10 : 0,
        },
        availability: availabilityStats.map((r) => ({
          status: r.status ?? null,
          count: r.count,
        })),
        addedLast30Days: recentCount[0]?.count ?? 0,
      },
      200,
    );
  } catch (error) {
    console.error('Catalog overview error:', error);
    return c.json({ error: 'Failed to fetch catalog overview', code: 'CATALOG_OVERVIEW_ERROR' }, 500);
  }
});

// ─── GET /brands ─────────────────────────────────────────────────────────────

const getBrandsRoute = createRoute({
  method: 'get',
  path: '/brands',
  tags: ['Admin'],
  summary: 'Top gear brands',
  description: 'Top brands by catalog item count with pricing and rating summaries (Admin only)',
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    }),
  },
  responses: {
    200: {
      description: 'Brand list',
      content: {
        'application/json': {
          schema: z.array(z.object({
            brand: z.string(),
            itemCount: z.number(),
            avgPrice: z.number().nullable(),
            minPrice: z.number().nullable(),
            maxPrice: z.number().nullable(),
            avgRating: z.number().nullable(),
          })),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

catalogRoutes.openapi(getBrandsRoute, async (c) => {
  const db = createDb(c);
  const { limit = 25 } = c.req.valid('query');

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

    return c.json(
      brands.map((b) => ({
        brand: b.brand ?? '',
        itemCount: b.itemCount,
        avgPrice: b.avgPrice != null ? Math.round(Number(b.avgPrice) * 100) / 100 : null,
        minPrice: b.minPrice != null ? Number(b.minPrice) : null,
        maxPrice: b.maxPrice != null ? Number(b.maxPrice) : null,
        avgRating: b.avgRating != null ? Math.round(Number(b.avgRating) * 10) / 10 : null,
      })),
      200,
    );
  } catch (error) {
    console.error('Catalog brands error:', error);
    return c.json({ error: 'Failed to fetch brand data', code: 'CATALOG_BRANDS_ERROR' }, 500);
  }
});

// ─── GET /prices ─────────────────────────────────────────────────────────────

const getPricesRoute = createRoute({
  method: 'get',
  path: '/prices',
  tags: ['Admin'],
  summary: 'Price distribution',
  description: 'Distribution of catalog items across price buckets (Admin only)',
  responses: {
    200: {
      description: 'Price distribution buckets',
      content: {
        'application/json': {
          schema: z.array(z.object({
            bucket: z.string(),
            count: z.number(),
          })),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

catalogRoutes.openapi(getPricesRoute, async (c) => {
  const db = createDb(c);

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
      .select({
        bucket: bucketExpr,
        count: count(),
        minForOrder: min(catalogItems.price),
      })
      .from(catalogItems)
      .where(and(isNotNull(catalogItems.price), gt(catalogItems.price, 0)))
      .groupBy(bucketExpr)
      .orderBy(min(catalogItems.price));

    return c.json(
      distribution.map((r) => ({ bucket: r.bucket, count: r.count })),
      200,
    );
  } catch (error) {
    console.error('Catalog prices error:', error);
    return c.json({ error: 'Failed to fetch price distribution', code: 'CATALOG_PRICES_ERROR' }, 500);
  }
});

// ─── GET /etl ─────────────────────────────────────────────────────────────────

const getEtlRoute = createRoute({
  method: 'get',
  path: '/etl',
  tags: ['Admin'],
  summary: 'ETL pipeline history',
  description: 'History of catalog data ingestion jobs with success/failure rates (Admin only)',
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    }),
  },
  responses: {
    200: {
      description: 'ETL job history',
      content: {
        'application/json': {
          schema: z.object({
            jobs: z.array(z.object({
              id: z.string(),
              status: z.enum(['running', 'completed', 'failed']),
              source: z.string(),
              filename: z.string(),
              scraperRevision: z.string(),
              startedAt: z.string(),
              completedAt: z.string().nullable(),
              totalProcessed: z.number().nullable(),
              totalValid: z.number().nullable(),
              totalInvalid: z.number().nullable(),
              successRate: z.number().nullable(),
            })),
            summary: z.object({
              totalRuns: z.number(),
              completed: z.number(),
              failed: z.number(),
              totalItemsIngested: z.number(),
            }),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

catalogRoutes.openapi(getEtlRoute, async (c) => {
  const db = createDb(c);
  const { limit = 50 } = c.req.valid('query');

  try {
    const [jobs, summary] = await Promise.all([
      db
        .select()
        .from(etlJobs)
        .orderBy(desc(etlJobs.startedAt))
        .limit(limit),

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

    return c.json(
      {
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
      },
      200,
    );
  } catch (error) {
    console.error('Catalog ETL error:', error);
    return c.json({ error: 'Failed to fetch ETL history', code: 'CATALOG_ETL_ERROR' }, 500);
  }
});

// ─── GET /embeddings ──────────────────────────────────────────────────────────

const getEmbeddingsRoute = createRoute({
  method: 'get',
  path: '/embeddings',
  tags: ['Admin'],
  summary: 'Embedding coverage',
  description: 'How many catalog items have vector embeddings vs. are pending (Admin only)',
  responses: {
    200: {
      description: 'Embedding coverage stats',
      content: {
        'application/json': {
          schema: z.object({
            total: z.number(),
            withEmbedding: z.number(),
            pending: z.number(),
            coveragePct: z.number(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

catalogRoutes.openapi(getEmbeddingsRoute, async (c) => {
  const db = createDb(c);

  try {
    const [total, withEmbedding] = await Promise.all([
      db.select({ count: count() }).from(catalogItems),
      db.select({ count: count() }).from(catalogItems).where(isNotNull(catalogItems.embedding)),
    ]);

    const totalCount = total[0]?.count ?? 0;
    const embeddedCount = withEmbedding[0]?.count ?? 0;

    return c.json(
      {
        total: totalCount,
        withEmbedding: embeddedCount,
        pending: totalCount - embeddedCount,
        coveragePct: totalCount > 0 ? Math.round((embeddedCount / totalCount) * 1000) / 10 : 0,
      },
      200,
    );
  } catch (error) {
    console.error('Catalog embeddings error:', error);
    return c.json({ error: 'Failed to fetch embedding stats', code: 'CATALOG_EMBEDDINGS_ERROR' }, 500);
  }
});
