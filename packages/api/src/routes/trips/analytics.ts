import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { and, eq } from 'drizzle-orm';

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
    mostActiveMonth: z.string().nullable().openapi({ example: 'July' }),
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

tripAnalyticsRoutes.openapi(getAnalyticsRoute, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);

  try {
    const userTrips = await db.query.trips.findMany({
      where: and(eq(trips.userId, auth.userId), eq(trips.deleted, false)),
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    // ----- Core counts -----
    const totalTrips = userTrips.length;
    const completedTrips = userTrips.filter((t) => t.endDate && new Date(t.endDate) < now).length;
    const upcomingTrips = userTrips.filter(
      (t) => t.startDate && new Date(t.startDate) > now,
    ).length;

    // ----- Duration stats -----
    const tripsWithDuration = userTrips
      .filter(
        (t): t is typeof t & { startDate: Date; endDate: Date } =>
          t.startDate !== null &&
          t.startDate !== undefined &&
          t.endDate !== null &&
          t.endDate !== undefined,
      )
      .map((t) => {
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        const durationMs = end.getTime() - start.getTime();
        const durationDays = Math.max(0, Math.round(durationMs / (1000 * 60 * 60 * 24)));
        return { ...t, durationDays };
      });

    const totalNightsOutdoors = tripsWithDuration.reduce((sum, t) => sum + t.durationDays, 0);

    const averageTripDurationDays =
      tripsWithDuration.length > 0
        ? Math.round(
            (tripsWithDuration.reduce((sum, t) => sum + t.durationDays, 0) /
              tripsWithDuration.length) *
              10,
          ) / 10
        : null;

    const longestTrip =
      tripsWithDuration.length > 0
        ? tripsWithDuration.reduce((max, t) => (t.durationDays > max.durationDays ? t : max))
        : null;

    const longestTripDays = longestTrip?.durationDays ?? null;
    const longestTripName = longestTrip?.name ?? null;

    // ----- Monthly trends (last 12 months) -----
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

    // Build the set of valid month keys for the last 12 months
    const monthlyCounts: Record<string, number> = {};
    const validMonthKeys = new Set<string>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[key] = 0;
      validMonthKeys.add(key);
    }

    // Only count trips that fall within the last 12 months window
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (const trip of userTrips) {
      const date = trip.startDate ?? trip.createdAt;
      if (!date) continue;
      const d = new Date(date);
      if (d < windowStart) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (validMonthKeys.has(key)) {
        monthlyCounts[key]++;
      }
    }

    const tripsByMonth = Object.entries(monthlyCounts).map(([key, count]) => {
      const [year, month] = key.split('-');
      return { month: `${MONTH_NAMES[Number(month) - 1]} ${year}`, count };
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
    const tripsWithLocation = userTrips.filter((t) => t.location);
    const locationsVisited = tripsWithLocation.length;

    // Extract region names from location.name when available
    const regionSet = new Set<string>();
    for (const trip of tripsWithLocation) {
      if (trip.location?.name) {
        regionSet.add(trip.location.name);
      }
    }
    const uniqueRegions = Array.from(regionSet);

    // ----- Year-over-year -----
    const currentYearTrips = userTrips.filter((t) => {
      const date = t.startDate ?? t.createdAt;
      return date && new Date(date).getFullYear() === currentYear;
    }).length;

    const lastYearTrips = userTrips.filter((t) => {
      const date = t.startDate ?? t.createdAt;
      return date && new Date(date).getFullYear() === lastYear;
    }).length;

    return c.json(
      {
        totalTrips,
        completedTrips,
        upcomingTrips,
        totalNightsOutdoors,
        averageTripDurationDays,
        longestTripDays,
        longestTripName,
        mostActiveMonth,
        mostActiveMonthCount,
        tripsByMonth,
        locationsVisited,
        uniqueRegions,
        currentYearTrips,
        lastYearTrips,
      },
      200,
    );
  } catch (error) {
    console.error('Error computing trip analytics:', error);
    return c.json({ error: 'Failed to compute trip analytics' }, 500);
  }
});

export { tripAnalyticsRoutes };
