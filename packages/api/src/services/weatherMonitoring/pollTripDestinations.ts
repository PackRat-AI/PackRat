import { createDbClient } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { tripDestinationAlertState, trips } from '@packrat/db/schema';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { notifyTripOwner } from '../push/notifyTripOwner';
import { diffAlerts } from './diffAlerts';
import { fetchCoordinateAlerts } from './fetchLocationAlerts';

const POLL_INTERVAL_MS = 20 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A trip is watched from 10 days out (the forecast window) until a day after it starts. */
const HORIZON_MS = 10 * DAY_MS;
const GRACE_MS = DAY_MS;

export type TripPollResult = {
  checked: number;
  skipped: number;
  failed: number;
  notified: number;
};

/**
 * One pass of the trip-destination alert cron: every upcoming trip with a
 * destination is checked for weather alerts there, and the trip's owner is
 * pushed each alert once — the way a watched location's alert reaches its
 * watchers, without the user having watched the place. Never pushes on
 * resolution. Trips sharing a destination cost one WeatherAPI call per run.
 * See docs/features/pre-trip-reminders.md ("Conditions at the destination").
 */
export async function pollTripDestinations({
  env,
  now = new Date(),
}: {
  env: ValidatedEnv;
  now?: Date;
}): Promise<TripPollResult> {
  const db = createDbClient(env);

  const upcoming = await db
    .tag('tripReminders.listUpcomingTripDestinations')
    .select({
      id: trips.id,
      userId: trips.userId,
      name: trips.name,
      location: trips.location,
    })
    .from(trips)
    .where(
      and(
        eq(trips.deleted, false),
        isNotNull(trips.location),
        gte(trips.startDate, new Date(now.getTime() - GRACE_MS)),
        lte(trips.startDate, new Date(now.getTime() + HORIZON_MS)),
      ),
    );

  const states = await db
    .tag('tripReminders.listDestinationAlertState')
    .select({
      tripId: tripDestinationAlertState.tripId,
      lastAlertIds: tripDestinationAlertState.lastAlertIds,
      lastPolledAt: tripDestinationAlertState.lastPolledAt,
    })
    .from(tripDestinationAlertState);
  const stateByTrip = new Map(states.map((s) => [s.tripId, s]));

  // Per-run cache: trips heading to the same place share one fetch.
  const alertsByPlace = new Map<string, Promise<WeatherAlertItem[]>>();
  const result: TripPollResult = { checked: 0, skipped: 0, failed: 0, notified: 0 };

  for (const trip of upcoming) {
    const location = trip.location;
    if (!location) continue;
    const state = stateByTrip.get(trip.id);
    const dueAt = state?.lastPolledAt ? state.lastPolledAt.getTime() + POLL_INTERVAL_MS : 0;
    if (now.getTime() < dueAt) {
      result.skipped++;
      continue;
    }
    result.checked++;

    try {
      const placeKey = `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
      let pending = alertsByPlace.get(placeKey);
      if (!pending) {
        pending = fetchCoordinateAlerts(location);
        alertsByPlace.set(placeKey, pending);
      }
      const diff = diffAlerts({
        previousIds: state?.lastAlertIds ?? [],
        currentAlerts: await pending,
      });

      await db
        .tag('tripReminders.upsertDestinationAlertState')
        .insert(tripDestinationAlertState)
        .values({
          tripId: trip.id,
          lastAlertIds: diff.currentIds,
          lastPolledAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: tripDestinationAlertState.tripId,
          set: { lastAlertIds: diff.currentIds, lastPolledAt: now, updatedAt: now },
        });

      if (diff.newAlerts.length > 0) {
        await notifyTripOwner({
          env,
          userId: trip.userId,
          tripId: trip.id,
          tripName: trip.name,
          placeName: location.name ?? null,
          newAlerts: diff.newAlerts,
        });
        result.notified++;
      }
    } catch (error) {
      result.failed++;
      captureApiException({
        error,
        operation: 'tripReminders.pollTripDestination',
        tags: { feature: 'tripReminders' },
        extra: { tripId: trip.id },
      });
    }
  }

  return result;
}
