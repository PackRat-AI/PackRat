import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { and, count, eq, isNotNull, sql } from 'drizzle-orm';

const tripAnalyticsRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// ---------------------------------------------------------------------------
// Response Schema
// ---------------------------------------------------------------------------

const TripAnalyticsSchema = z
  .object({
    totalTrips: z.number().openapi({ example: 12 }),
    completedTrips: z.number().openapi({ example: 10 }),
    upcomingTrips: z.number().openapi({ example: 2 }),
    totalNightsOutdoors: z.number().openapi({ example: 45 }),
    averageTripDurationDays: z.number().nullable().openapi({ example: 4.5 }),
    longestTripDays: z.number().nullable().openapi({ example: 14 }),
    longestTripName: z.string().nullable().openapi({ example: 'PCT Section J' }),
    mostActiveMonth: z.string().nullable().openapi({ example: 'Jul 2026' }),
    mostActiveMonthCount: z.number().nullable().openapi({ example: 3 }),
    tripsByMonth: z
      .array(
        z.object({
          month: z.string(),
          count: z.number(),
        }),
      )
      .openapi({ description: 'Trip count per month for the last 12 months' }),
    locationsVisited: z.number().openapi({ example: 8 }),
    uniqueRegions: z.array(z.string()).openapi({ example: ['Rocky Mountains', 'Pacific Coast'] }),
    currentYearTrips: z.number().openapi({ example: 5 }),
    lastYearTrips: z.number().openapi({ example: 7 }),
  })
  .openapi('TripAnalytics');

// ---------------------------------------------------------------------------
// GET /api/trips/analytics
// ---------------------------------------------------------------------------

const getAnalyticsRoute = createRoute({
  method: 'get',
  path: '/analytics',
  tags: ['Trips'],
  summary: 'Get trip analytics',
  description: 'Compute and return personal trip statistics for the authenticated user',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Analytics retrieved successfully',
      content: {
        'application/json': { schema: TripAnalyticsSchema },
      },
    },
    500: {
      description: 'Failed to retrieve analytics',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

tripAnalyticsRoutes.openapi(getAnalyticsRoute, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const baseWhere = and(eq(trips.userId, auth.userId), eq(trips.deleted, false));

    // ----- Core counts (pushed to SQL) -----
    const [coreRow] = await db
      .select({
        totalTrips: count(),
        completedTrips: sql<number>`COUNT(*) FILTER (WHERE ${trips.endDate} IS NOT NULL AND ${trips.endDate} < ${now})`,
        upcomingTrips: sql<number>`COUNT(*) FILTER (WHERE ${trips.startDate} IS NOT NULL AND ${trips.startDate} > ${now})`,
        locationsVisited: sql<number>`COUNT(*) FILTER (WHERE ${trips.location} IS NOT NULL)`,
        currentYearTrips: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM COALESCE(${trips.startDate}, ${trips.createdAt})) = ${currentYear})`,
        lastYearTrips: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM COALESCE(${trips.startDate}, ${trips.createdAt})) = ${lastYear})`,
      })
      .from(trips)
      .where(baseWhere);

    // ----- Duration stats (pushed to SQL) -----
    // Use CEIL so a 1-night trip (< 24h but crosses midnight) counts as 1 day
    const [durationRow] = await db
      .select({
        totalNightsOutdoors: sql<number>`COALESCE(SUM(CEIL(EXTRACT(EPOCH FROM (${trips.endDate} - ${trips.startDate})) / 86400)), 0)`,
        tripsWithDurationCount: sql<number>`COUNT(*) FILTER (WHERE ${trips.startDate} IS NOT NULL AND ${trips.endDate} IS NOT NULL)`,
        longestTripDays: sql<
          number | null
        >`MAX(CEIL(EXTRACT(EPOCH FROM (${trips.endDate} - ${trips.startDate})) / 86400))`,
      })
      .from(trips)
      .where(and(baseWhere, isNotNull(trips.startDate), isNotNull(trips.endDate)));

    // Fetch the name of the longest trip (need a separate query for the name)
    const longestTripDays = durationRow?.longestTripDays
      ? Number(durationRow.longestTripDays)
      : null;

    let longestTripName: string | null = null;
    if (longestTripDays !== null && longestTripDays > 0) {
      const [longestRow] = await db
        .select({ name: trips.name })
        .from(trips)
        .where(
          and(
            baseWhere,
            isNotNull(trips.startDate),
            isNotNull(trips.endDate),
            sql`CEIL(EXTRACT(EPOCH FROM (${trips.endDate} - ${trips.startDate})) / 86400) = ${longestTripDays}`,
          ),
        )
        .limit(1);
      longestTripName = longestRow?.name ?? null;
    }

    const totalNightsOutdoors = durationRow?.totalNightsOutdoors
      ? Number(durationRow.totalNightsOutdoors)
      : 0;
    const tripsWithDurationCount = durationRow?.tripsWithDurationCount
      ? Number(durationRow.tripsWithDurationCount)
      : 0;

    const averageTripDurationDays =
      tripsWithDurationCount > 0
        ? Math.round((totalNightsOutdoors / tripsWithDurationCount) * 10) / 10
        : null;

    // ----- Monthly trends (last 12 months) — pushed to SQL -----
    const monthlyRows = await db
      .select({
        yearMonth: sql<string>`TO_CHAR(DATE_TRUNC('month', COALESCE(${trips.startDate}, ${trips.createdAt})), 'YYYY-MM')`,
        tripCount: count(),
      })
      .from(trips)
      .where(
        and(
          baseWhere,
          sql`COALESCE(${trips.startDate}, ${trips.createdAt}) >= ${windowStart}`,
          sql`COALESCE(${trips.startDate}, ${trips.createdAt}) < ${now}`,
        ),
      )
      .groupBy(sql`DATE_TRUNC('month', COALESCE(${trips.startDate}, ${trips.createdAt}))`)
      .orderBy(sql`DATE_TRUNC('month', COALESCE(${trips.startDate}, ${trips.createdAt}))`);

    // Build the full 12-month scaffold and fill in SQL results
    const monthlyCounts: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[key] = 0;
    }
    for (const row of monthlyRows) {
      if (row.yearMonth in monthlyCounts) {
        monthlyCounts[row.yearMonth] = Number(row.tripCount);
      }
    }

    const tripsByMonth = Object.entries(monthlyCounts).map(([key, tripCount]) => {
      const [year, month] = key.split('-');
      return { month: `${MONTH_NAMES[Number(month) - 1]} ${year}`, count: tripCount };
    });

    // ----- Most active month -----
    let mostActiveMonth: string | null = null;
    let mostActiveMonthCount: number | null = null;
    if (tripsByMonth.length > 0) {
      const best = tripsByMonth.reduce((max, m) => (m.count > max.count ? m : max));
      if (best.count > 0) {
        mostActiveMonth = best.month;
        mostActiveMonthCount = best.count;
      }
    }

    // ----- Geographic stats -----
    // uniqueRegions: extract location.name from JSONB — kept in JS since it's a small set
    const locationRows = await db
      .select({ location: trips.location })
      .from(trips)
      .where(and(baseWhere, isNotNull(trips.location)));

    const regionSet = new Set<string>();
    for (const row of locationRows) {
      if (row.location?.name) {
        regionSet.add(row.location.name);
      }
    }
    const uniqueRegions = Array.from(regionSet);

    return c.json(
      {
        totalTrips: Number(coreRow?.totalTrips ?? 0),
        completedTrips: Number(coreRow?.completedTrips ?? 0),
        upcomingTrips: Number(coreRow?.upcomingTrips ?? 0),
        totalNightsOutdoors,
        averageTripDurationDays,
        longestTripDays,
        longestTripName,
        mostActiveMonth,
        mostActiveMonthCount,
        tripsByMonth,
        locationsVisited: Number(coreRow?.locationsVisited ?? 0),
        uniqueRegions,
        currentYearTrips: Number(coreRow?.currentYearTrips ?? 0),
        lastYearTrips: Number(coreRow?.lastYearTrips ?? 0),
      },
      200,
    );
  } catch (error) {
    console.error('Error computing trip analytics:', error);
    return c.json({ error: 'Failed to compute trip analytics' }, 500);
  }
});

export { tripAnalyticsRoutes };
