import { createDbClient } from '@packrat/api/db';
import { getEnv, type ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { trips } from '@packrat/db/schema';
import { and, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { GRACE_MS, HORIZON_MS, tripWatchFor } from './tripDestinationWatch';

type TripRow = Parameters<typeof tripWatchFor>[0]['trip'];

function timerFor({ tripId, env = getEnv() }: { tripId: string; env?: ValidatedEnv }) {
  const namespace = env.TRIP_DESTINATION_WATCHER;
  if (!namespace) return null;
  return namespace.get(namespace.idFromName(tripId));
}

/**
 * Points the trip's timer at its current name, destination and dates, or
 * clears it when the trip has nothing left to watch. Best effort: the trip
 * write has already landed, and the daily re-arm repairs a timer that missed it.
 */
export async function syncTripDestinationTimer({
  trip,
  now = Date.now(),
}: {
  trip: TripRow;
  now?: number;
}): Promise<void> {
  try {
    const timer = timerFor({ tripId: trip.id });
    if (!timer) return;
    const watch = tripWatchFor({ trip, now });
    if (watch) await timer.arm(watch);
    else await timer.disarm();
  } catch (error) {
    captureApiException({
      error,
      operation: 'tripReminders.syncDestinationTimer',
      tags: { feature: 'tripReminders' },
      extra: { tripId: trip.id },
    });
  }
}

/** Clears the timer of a deleted trip. A stray alarm would stop itself anyway. */
export async function disarmTripDestinationTimer({ tripId }: { tripId: string }): Promise<void> {
  try {
    await timerFor({ tripId })?.disarm();
  } catch (error) {
    captureApiException({
      error,
      operation: 'tripReminders.disarmDestinationTimer',
      tags: { feature: 'tripReminders' },
      extra: { tripId },
    });
  }
}

/**
 * Daily backstop: arms the timer of every trip inside its watch window.
 * Arming keeps a running timer's schedule, so this only starts timers that
 * are missing — trips saved before the timers existed, or a failed arm.
 */
export async function rearmTripDestinationTimers({
  env,
  now = Date.now(),
}: {
  env: ValidatedEnv;
  now?: number;
}): Promise<{ armed: number }> {
  const db = createDbClient(env);
  const upcoming = await db
    .tag('tripReminders.listUpcomingTripDestinations')
    .select({
      id: trips.id,
      userId: trips.userId,
      name: trips.name,
      deleted: trips.deleted,
      weatherAlerts: trips.weatherAlerts,
      location: trips.location,
      startDate: trips.startDate,
      endDate: trips.endDate,
    })
    .from(trips)
    .where(
      and(
        eq(trips.deleted, false),
        eq(trips.weatherAlerts, true),
        isNotNull(trips.location),
        lte(trips.startDate, new Date(now + HORIZON_MS)),
        or(
          gte(trips.endDate, new Date(now - GRACE_MS)),
          and(isNull(trips.endDate), gte(trips.startDate, new Date(now - GRACE_MS))),
        ),
      ),
    );

  let armed = 0;
  for (const trip of upcoming) {
    const timer = timerFor({ tripId: trip.id, env });
    if (!timer) break;
    const watch = tripWatchFor({ trip, now });
    if (!watch) continue;
    await timer.arm(watch);
    armed++;
  }
  return { armed };
}
