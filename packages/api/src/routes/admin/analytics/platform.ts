import { createDb } from '@packrat/api/db';
import {
  catalogItems,
  packs,
  posts,
  trailConditionReports,
  trips,
  users,
} from '@packrat/api/db/schema';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const PeriodSchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('month'),
  range: z.coerce.number().int().min(1).max(365).optional().default(12),
});

function getStartDate(period: 'day' | 'week' | 'month', range: number): Date {
  const d = new Date();
  if (period === 'day') d.setDate(d.getDate() - range);
  else if (period === 'week') d.setDate(d.getDate() - range * 7);
  else d.setMonth(d.getMonth() - range);
  return d;
}

export const platformAnalyticsRoutes = new Elysia({ prefix: '/platform' })
  .get('/', () => ({
    analytics: {
      growth: '/api/admin/analytics/platform/growth',
      activity: '/api/admin/analytics/platform/activity',
      breakdown: '/api/admin/analytics/platform/breakdown',
    },
  }))

  .get(
    '/growth',
    async ({ query }) => {
      const db = createDb();
      const { period = 'month', range = 12 } = query;
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

        const userMap = Object.fromEntries(userGrowth.map((r) => [r.date, r.count]));
        const packMap = Object.fromEntries(packGrowth.map((r) => [r.date, r.count]));
        const catalogMap = Object.fromEntries(catalogGrowth.map((r) => [r.date, r.count]));
        const allDates = [
          ...new Set([
            ...userGrowth.map((r) => r.date),
            ...packGrowth.map((r) => r.date),
            ...catalogGrowth.map((r) => r.date),
          ]),
        ].sort();

        return allDates.map((date) => ({
          period: date,
          users: userMap[date] ?? 0,
          packs: packMap[date] ?? 0,
          catalogItems: catalogMap[date] ?? 0,
        }));
      } catch (error) {
        console.error('Analytics growth error:', error);
        return status(500, {
          error: 'Failed to fetch growth data',
          code: 'ANALYTICS_GROWTH_ERROR',
        });
      }
    },
    {
      query: PeriodSchema,
      detail: { tags: ['Admin'], summary: 'Platform growth metrics' },
    },
  )

  .get(
    '/activity',
    async ({ query }) => {
      const db = createDb();
      const { period = 'month', range = 12 } = query;
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

        const tripMap = Object.fromEntries(tripActivity.map((r) => [r.date, r.count]));
        const trailMap = Object.fromEntries(trailActivity.map((r) => [r.date, r.count]));
        const postMap = Object.fromEntries(postActivity.map((r) => [r.date, r.count]));
        const allDates = [
          ...new Set([
            ...tripActivity.map((r) => r.date),
            ...trailActivity.map((r) => r.date),
            ...postActivity.map((r) => r.date),
          ]),
        ].sort();

        return allDates.map((date) => ({
          period: date,
          trips: tripMap[date] ?? 0,
          trailReports: trailMap[date] ?? 0,
          posts: postMap[date] ?? 0,
        }));
      } catch (error) {
        console.error('Analytics activity error:', error);
        return status(500, {
          error: 'Failed to fetch activity data',
          code: 'ANALYTICS_ACTIVITY_ERROR',
        });
      }
    },
    {
      query: PeriodSchema,
      detail: { tags: ['Admin'], summary: 'User activity metrics' },
    },
  )

  .get(
    '/breakdown',
    async () => {
      const db = createDb();

      try {
        const packsByCategory = await db
          .select({ category: packs.category, count: count() })
          .from(packs)
          .where(eq(packs.deleted, false))
          .groupBy(packs.category)
          .orderBy(desc(count()));

        return packsByCategory.map((r) => ({
          category: r.category ?? 'Uncategorized',
          count: r.count,
        }));
      } catch (error) {
        console.error('Analytics breakdown error:', error);
        return status(500, {
          error: 'Failed to fetch breakdown data',
          code: 'ANALYTICS_BREAKDOWN_ERROR',
        });
      }
    },
    { detail: { tags: ['Admin'], summary: 'Categorical distribution metrics' } },
  );
