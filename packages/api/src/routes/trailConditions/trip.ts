import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { reportAuthorNames } from '@packrat/api/services/reportAuthors';
import { unreadReportIds } from '@packrat/api/services/trailConditionAlerts';
import { getTripTrailConditions } from '@packrat/api/services/tripTrailConditions';
import { trips } from '@packrat/db/schema';
import { and, eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { toReportResponse } from './reports';
import { trailDbOrNull } from './trailDb';

export const tripTrailConditionRoutes = new Elysia().use(authPlugin).get(
  '/trip/:tripId',
  async ({ params, user }) => {
    const db = createDb();
    const trip = await db.tag('tripTrailConditions.trip').query.trips.findFirst({
      columns: {
        id: true,
        trailId: true,
        location: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
      where: and(
        eq(trips.id, params.tripId),
        eq(trips.userId, user.userId),
        eq(trips.deleted, false),
      ),
    });
    if (!trip) return status(404, { error: 'Trip not found' });

    const result = await getTripTrailConditions({
      db,
      trailDb: trailDbOrNull(),
      viewerId: user.userId,
      trip: {
        id: trip.id,
        trailId: trip.trailId,
        location: trip.location
          ? { latitude: trip.location.latitude, longitude: trip.location.longitude }
          : null,
      },
    });
    const authorName = await reportAuthorNames({
      db,
      userIds: result.reports.map((r) => r.userId),
    });
    const unread = await unreadReportIds({
      db,
      trip,
      reports: result.reports,
      viewerId: user.userId,
      now: new Date(),
    });

    return {
      scope: result.scope,
      reports: result.reports.map((r) => ({
        ...toReportResponse(r),
        distanceM: r.distanceM,
        authorName: authorName.get(r.userId) ?? null,
        unread: unread.has(r.id),
      })),
    };
  },
  {
    params: z.object({ tripId: z.string() }),
    isAuthenticated: true,
    detail: {
      tags: ['Trail Conditions'],
      summary: "Reports for a trip's trail, or trails near its destination",
      security: [{ bearerAuth: [] }],
    },
  },
);
