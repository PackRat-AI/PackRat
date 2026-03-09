import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packItems, trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { and, eq } from 'drizzle-orm';

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

    // Fetch upcoming trips (not deleted, start date in the future or today)
    const upcomingTrips = await db.query.trips.findMany({
      where: and(eq(trips.userId, auth.userId), eq(trips.deleted, false)),
      with: { pack: true },
      orderBy: (t) => t.startDate,
    });

    const futureTrips = upcomingTrips.filter((trip) => {
      if (!trip.startDate) return false;
      const start = new Date(trip.startDate);
      const diffMs = start.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 30;
    });

    const notifications: z.infer<typeof TripNotificationSchema>[] = [];

    for (const trip of futureTrips) {
      if (!trip.startDate) continue;

      const startDate = new Date(trip.startDate);
      const diffMs = startDate.getTime() - now.getTime();
      const daysUntilTrip = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const startDateIso = startDate.toISOString();

      // Fetch pack item count for packing progress if pack is linked
      let packItemCount = 0;
      if (trip.packId) {
        const items = await db
          .select({ id: packItems.id })
          .from(packItems)
          .where(and(eq(packItems.packId, trip.packId), eq(packItems.deleted, false)));
        packItemCount = items.length;
      }

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
        // 2–3 days before: packing reminder + optional progress card
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
      }

      // Add a separate pack progress notification for trips 4–7 days out that have items
      if (trip.packId && packItemCount > 0 && daysUntilTrip >= 4 && daysUntilTrip <= 7) {
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
