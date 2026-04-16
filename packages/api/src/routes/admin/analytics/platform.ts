import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import {
  catalogItems,
  packs,
  posts,
  trailConditionReports,
  trips,
  users,
} from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';

export const platformRoutes = new OpenAPIHono<{ Bindings: Env }>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const PeriodSchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('month'),
  range: z.coerce.number().int().min(1).max(365).optional().default(12),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStartDate(period: 'day' | 'week' | 'month', range: number): Date {
  const d = new Date();
  if (period === 'day') d.setDate(d.getDate() - range);
  else if (period === 'week') d.setDate(d.getDate() - range * 7);
  else d.setMonth(d.getMonth() - range);
  return d;
}

// ─── Platform analytics root ─────────────────────────────────────────────────

platformRoutes.get('/', (c) =>
  c.json({
    analytics: {
      growth: '/api/admin/analytics/platform/growth',
      activity: '/api/admin/analytics/platform/activity',
      breakdown: '/api/admin/analytics/platform/breakdown',
    },
  }),
);

// ─── GET /growth ─────────────────────────────────────────────────────────────

const getGrowthRoute = createRoute({
  method: 'get',
  path: '/growth',
  tags: ['Admin'],
  summary: 'Platform growth metrics',
  description:
    'Time-series data for user registrations, pack creation, and catalog item additions (Admin only)',
  request: { query: PeriodSchema },
  responses: {
    200: {
      description: 'Growth time-series data — one entry per period bucket',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              period: z.string(),
              users: z.number(),
              packs: z.number(),
              catalogItems: z.number(),
            }),
          ),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

platformRoutes.openapi(getGrowthRoute, async (c) => {
  const db = createDb(c);
  const { period = 'month', range = 12 } = c.req.valid('query');
  const startDate = getStartDate(period, range);

  try {
    const [userGrowth, packGrowth, catalogGrowth] = await Promise.all([
      db
        .select({
          date: sql<string>`date_trunc(${period}, ${users.createdAt})::date::text`,
          count: count(),
        })
        .from(users)
        .where(gte(users.createdAt, startDate))
        .groupBy(sql`date_trunc(${period}, ${users.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${users.createdAt})`),

      db
        .select({
          date: sql<string>`date_trunc(${period}, ${packs.createdAt})::date::text`,
          count: count(),
        })
        .from(packs)
        .where(and(eq(packs.deleted, false), gte(packs.createdAt, startDate)))
        .groupBy(sql`date_trunc(${period}, ${packs.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${packs.createdAt})`),

      db
        .select({
          date: sql<string>`date_trunc(${period}, ${catalogItems.createdAt})::date::text`,
          count: count(),
        })
        .from(catalogItems)
        .where(gte(catalogItems.createdAt, startDate))
        .groupBy(sql`date_trunc(${period}, ${catalogItems.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${catalogItems.createdAt})`),
    ]);

    const userMap: Record<string, number> = Object.fromEntries(
      userGrowth.map((r) => [r.date, r.count]),
    );
    const packMap: Record<string, number> = Object.fromEntries(
      packGrowth.map((r) => [r.date, r.count]),
    );
    const catalogMap: Record<string, number> = Object.fromEntries(
      catalogGrowth.map((r) => [r.date, r.count]),
    );
    const allDates = [
      ...new Set([
        ...userGrowth.map((r) => r.date),
        ...packGrowth.map((r) => r.date),
        ...catalogGrowth.map((r) => r.date),
      ]),
    ].sort();

    return c.json(
      allDates.map((date) => ({
        period: date,
        users: userMap[date] ?? 0,
        packs: packMap[date] ?? 0,
        catalogItems: catalogMap[date] ?? 0,
      })),
      200,
    );
  } catch (error) {
    console.error('Analytics growth error:', error);
    return c.json({ error: 'Failed to fetch growth data', code: 'ANALYTICS_GROWTH_ERROR' }, 500);
  }
});

// ─── GET /activity ───────────────────────────────────────────────────────────

const getActivityRoute = createRoute({
  method: 'get',
  path: '/activity',
  tags: ['Admin'],
  summary: 'User activity metrics',
  description:
    'Time-series data for trips created, trail condition reports, and social posts (Admin only)',
  request: { query: PeriodSchema },
  responses: {
    200: {
      description: 'Activity time-series data — one entry per period bucket',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              period: z.string(),
              trips: z.number(),
              trailReports: z.number(),
              posts: z.number(),
            }),
          ),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

platformRoutes.openapi(getActivityRoute, async (c) => {
  const db = createDb(c);
  const { period = 'month', range = 12 } = c.req.valid('query');
  const startDate = getStartDate(period, range);

  try {
    const [tripActivity, trailActivity, postActivity] = await Promise.all([
      db
        .select({
          date: sql<string>`date_trunc(${period}, ${trips.createdAt})::date::text`,
          count: count(),
        })
        .from(trips)
        .where(and(eq(trips.deleted, false), gte(trips.createdAt, startDate)))
        .groupBy(sql`date_trunc(${period}, ${trips.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${trips.createdAt})`),

      db
        .select({
          date: sql<string>`date_trunc(${period}, ${trailConditionReports.createdAt})::date::text`,
          count: count(),
        })
        .from(trailConditionReports)
        .where(
          and(
            eq(trailConditionReports.deleted, false),
            gte(trailConditionReports.createdAt, startDate),
          ),
        )
        .groupBy(sql`date_trunc(${period}, ${trailConditionReports.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${trailConditionReports.createdAt})`),

      db
        .select({
          date: sql<string>`date_trunc(${period}, ${posts.createdAt})::date::text`,
          count: count(),
        })
        .from(posts)
        .where(gte(posts.createdAt, startDate))
        .groupBy(sql`date_trunc(${period}, ${posts.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${posts.createdAt})`),
    ]);

    const tripMap: Record<string, number> = Object.fromEntries(
      tripActivity.map((r) => [r.date, r.count]),
    );
    const trailMap: Record<string, number> = Object.fromEntries(
      trailActivity.map((r) => [r.date, r.count]),
    );
    const postMap: Record<string, number> = Object.fromEntries(
      postActivity.map((r) => [r.date, r.count]),
    );
    const allDates = [
      ...new Set([
        ...tripActivity.map((r) => r.date),
        ...trailActivity.map((r) => r.date),
        ...postActivity.map((r) => r.date),
      ]),
    ].sort();

    return c.json(
      allDates.map((date) => ({
        period: date,
        trips: tripMap[date] ?? 0,
        trailReports: trailMap[date] ?? 0,
        posts: postMap[date] ?? 0,
      })),
      200,
    );
  } catch (error) {
    console.error('Analytics activity error:', error);
    return c.json(
      { error: 'Failed to fetch activity data', code: 'ANALYTICS_ACTIVITY_ERROR' },
      500,
    );
  }
});

// ─── GET /breakdown ──────────────────────────────────────────────────────────

const getBreakdownRoute = createRoute({
  method: 'get',
  path: '/breakdown',
  tags: ['Admin'],
  summary: 'Categorical distribution metrics',
  description:
    'Breakdown of packs and pack items by category, ordered by count descending (Admin only)',
  responses: {
    200: {
      description: 'Pack category breakdown, ordered by count descending',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              category: z.string(),
              count: z.number(),
            }),
          ),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

platformRoutes.openapi(getBreakdownRoute, async (c) => {
  const db = createDb(c);

  try {
    const packsByCategory = await db
      .select({ category: packs.category, count: count() })
      .from(packs)
      .where(eq(packs.deleted, false))
      .groupBy(packs.category)
      .orderBy(desc(count()));

    return c.json(
      packsByCategory.map((r) => ({
        category: r.category ?? 'Uncategorized',
        count: r.count,
      })),
      200,
    );
  } catch (error) {
    console.error('Analytics breakdown error:', error);
    return c.json(
      { error: 'Failed to fetch breakdown data', code: 'ANALYTICS_BREAKDOWN_ERROR' },
      500,
    );
  }
});
