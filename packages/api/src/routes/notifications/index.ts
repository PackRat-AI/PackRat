import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packItems, trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';

const notificationsRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TripNotificationSchema = z
  .object({
    tripId: z.string(),
    tripName: z.string(),
    startDate: z.string().nullable(),
    daysUntilTrip: z.number().nullable(),
    type: z.enum([
      'week_reminder',
      'three_day_reminder',
      'day_before',
      'morning_of',
      'pack_progress',
      'device_charging',
    ]),
    title: z.string(),
    message: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  })
  .openapi('TripNotification');

const TripRemindersResponseSchema = z
  .object({
    notifications: z.array(TripNotificationSchema),
    upcomingTripsCount: z.number(),
  })
  .openapi('TripRemindersResponse');

// ---------------------------------------------------------------------------
// GET /api/notifications/trip-reminders
// ---------------------------------------------------------------------------
const getTripRemindersRoute = createRoute({
  method: 'get',
  path: '/trip-reminders',
  tags: ['Notifications'],
  summary: 'Get smart pre-trip notifications',
  description:
    'Returns intelligent pre-trip reminders based on upcoming trips, including packing reminders, device charging alerts, and trip readiness checks.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Trip reminders retrieved successfully',
      content: {
        'application/json': { schema: TripRemindersResponseSchema },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

notificationsRoutes.openapi(getTripRemindersRoute, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);

  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Use calendar-date midnight as "today" boundary to avoid timezone edge cases
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch upcoming trips filtered at DB level (no full table scan)
    const futureTrips = await db.query.trips.findMany({
      where: and(
        eq(trips.userId, auth.userId),
        eq(trips.deleted, false),
        gte(trips.startDate, todayStart),
        lte(trips.startDate, thirtyDaysFromNow),
      ),
      with: { pack: true },
      orderBy: (t) => [asc(t.startDate)],
    });

    // Batch-fetch pack item counts to avoid N+1 queries
    const packIds = futureTrips.map((t) => t.packId).filter((id): id is string => !!id);
    const allPackItems = packIds.length
      ? await db
          .select({ packId: packItems.packId, id: packItems.id })
          .from(packItems)
          .where(and(inArray(packItems.packId, packIds), eq(packItems.deleted, false)))
      : [];

    const itemCountByPackId = allPackItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.packId] = (acc[item.packId] ?? 0) + 1;
      return acc;
    }, {});

    const notifications: z.infer<typeof TripNotificationSchema>[] = [];

    for (const trip of futureTrips) {
      if (!trip.startDate) continue;

      const startDate = new Date(trip.startDate);
      const startDateIso = startDate.toISOString();

      // Compare calendar dates (year/month/day only) to handle time-of-day correctly
      const tripCalendarDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
      );
      const daysUntilTrip = Math.round(
        (tripCalendarDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      const packItemCount = trip.packId ? (itemCountByPackId[trip.packId] ?? 0) : 0;
      const packSuffix = (count: number) => `item${count !== 1 ? 's' : ''}`;

      if (daysUntilTrip === 0) {
        // Morning of the trip
        notifications.push({
          tripId: trip.id,
          tripName: trip.name,
          startDate: startDateIso,
          daysUntilTrip: 0,
          type: 'morning_of',
          title: `Today's the day — ${trip.name}!`,
          message: trip.packId
            ? `Have a great trip! Double-check your ${packItemCount} packed ${packSuffix(packItemCount)} before heading out.`
            : "Have a great trip! Make sure you haven't forgotten anything.",
          priority: 'high',
        });
      } else if (daysUntilTrip === 1) {
        // Day before
        notifications.push({
          tripId: trip.id,
          tripName: trip.name,
          startDate: startDateIso,
          daysUntilTrip: 1,
          type: 'day_before',
          title: `${trip.name} is tomorrow!`,
          message: trip.packId
            ? `Final pack check — you have ${packItemCount} ${packSuffix(packItemCount)} in your pack. Don't forget to charge your devices tonight!`
            : "Final preparations! Don't forget to charge your phone, headlamp, and power bank.",
          priority: 'high',
        });

        // Add device charging alert for day before
        notifications.push({
          tripId: trip.id,
          tripName: trip.name,
          startDate: startDateIso,
          daysUntilTrip: 1,
          type: 'device_charging',
          title: 'Charge your devices tonight',
          message:
            'Plug in your phone, headlamp, GPS, and power bank before bed so they are ready for tomorrow.',
          priority: 'medium',
        });
      } else if (daysUntilTrip <= 3) {
        // 2–3 days before: packing reminder
        notifications.push({
          tripId: trip.id,
          tripName: trip.name,
          startDate: startDateIso,
          daysUntilTrip,
          type: 'three_day_reminder',
          title: `${trip.name} starts in ${daysUntilTrip} days`,
          message: trip.packId
            ? `Time to start packing! You have ${packItemCount} ${packSuffix(packItemCount)} in your pack list. Review and start gathering your gear.`
            : "Time to start packing! Review your gear list and start gathering everything you'll need.",
          priority: 'medium',
        });
      } else if (daysUntilTrip <= 7) {
        // 4–7 days before: week reminder
        notifications.push({
          tripId: trip.id,
          tripName: trip.name,
          startDate: startDateIso,
          daysUntilTrip,
          type: 'week_reminder',
          title: `${trip.name} is coming up`,
          message: trip.packId
            ? `Your trip is ${daysUntilTrip} days away. Review your pack list with ${packItemCount} ${packSuffix(packItemCount)} and make sure you have everything.`
            : `Your trip is ${daysUntilTrip} days away. Now is a great time to review your gear list!`,
          priority: 'low',
        });

        // Add a separate pack progress card when pack has items
        if (trip.packId && packItemCount > 0) {
          notifications.push({
            tripId: trip.id,
            tripName: trip.name,
            startDate: startDateIso,
            daysUntilTrip,
            type: 'pack_progress',
            title: 'Check your packing progress',
            message: `You have ${packItemCount} ${packSuffix(packItemCount)} in your pack for ${trip.name}. Go through your checklist to make sure everything is ready.`,
            priority: 'low',
          });
        }
      }
    }

    return c.json(
      {
        notifications,
        upcomingTripsCount: futureTrips.length,
      },
      200,
    );
  } catch (error) {
    console.error('Error fetching trip reminders:', error);
    return c.json({ error: 'Failed to fetch trip reminders' }, 500);
  }
});

export { notificationsRoutes };
