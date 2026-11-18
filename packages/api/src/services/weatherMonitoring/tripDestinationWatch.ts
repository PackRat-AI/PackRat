import { createDbClient } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { notificationPreferences, tripDestinationAlertState, trips } from '@packrat/db/schema';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { and, eq } from 'drizzle-orm';
import { notifyTripOwner } from '../push/notifyTripOwner';
import { diffAlerts } from './diffAlerts';
import { fetchCoordinateAlerts } from './fetchLocationAlerts';

export const POLL_INTERVAL_MS = 20 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A trip is watched from 3 days out until a day after it ends. Weather watches,
 * the earliest alerts, go out at most ~72 hours ahead; see
 * docs/features/trip-weather.md.
 */
export const HORIZON_MS = 3 * DAY_MS;
export const GRACE_MS = DAY_MS;

/** What a trip's timer keeps so a weather check never needs Postgres. */
export type TripWatch = {
  tripId: string;
  userId: string;
  name: string;
  location: { latitude: number; longitude: number; name?: string };
  startDate: number;
  /** Absent on timers armed before trips were watched to their end. */
  endDate?: number | null;
};

/** The period a trip's destination is checked for alerts. A trip with no end date lasts a day. */
export function watchWindow({ startDate, endDate }: Pick<TripWatch, 'startDate' | 'endDate'>): {
  opensAt: number;
  closesAt: number;
} {
  return { opensAt: startDate - HORIZON_MS, closesAt: (endDate ?? startDate) + GRACE_MS };
}

/**
 * The watch a trip row should have, or null when it has nothing to watch:
 * deleted, alerts turned off, no destination, no start date, or already past
 * its window.
 */
export function tripWatchFor({
  trip,
  now,
}: {
  trip: {
    id: string;
    userId: string;
    name: string;
    deleted: boolean;
    weatherAlerts: boolean;
    location: TripWatch['location'] | null;
    startDate: Date | null;
    endDate: Date | null;
  };
  now: number;
}): TripWatch | null {
  if (trip.deleted || !trip.weatherAlerts || !trip.location || !trip.startDate) return null;
  const startDate = trip.startDate.getTime();
  const endDate = trip.endDate?.getTime() ?? null;
  if (now > watchWindow({ startDate, endDate }).closesAt) return null;
  return {
    tripId: trip.id,
    userId: trip.userId,
    name: trip.name,
    location: trip.location,
    startDate,
    endDate,
  };
}

/**
 * Pushes alerts the timer saw for the first time to the trip's owner. Postgres
 * is the record of what was already pushed, so a timer that lost its storage
 * can't push the same alert twice. Returns `gone` when the trip was deleted or
 * its alerts turned off, so the timer can stop. With trip alerts off for the
 * whole account the alert is recorded but not pushed.
 */
export async function deliverTripDestinationAlerts({
  env,
  watch,
  alerts,
  now,
}: {
  env: ValidatedEnv;
  watch: TripWatch;
  alerts: WeatherAlertItem[];
  now: Date;
}): Promise<{ gone: boolean; notified: boolean }> {
  const db = createDbClient(env);
  const [row] = await db
    .tag('tripReminders.getDestinationAlertState')
    .select({
      lastAlertIds: tripDestinationAlertState.lastAlertIds,
      tripWeather: notificationPreferences.tripWeather,
    })
    .from(trips)
    .leftJoin(tripDestinationAlertState, eq(tripDestinationAlertState.tripId, trips.id))
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, trips.userId))
    .where(
      and(eq(trips.id, watch.tripId), eq(trips.deleted, false), eq(trips.weatherAlerts, true)),
    );
  if (!row) return { gone: true, notified: false };

  const diff = diffAlerts({ previousIds: row.lastAlertIds ?? [], currentAlerts: alerts });
  await db
    .tag('tripReminders.upsertDestinationAlertState')
    .insert(tripDestinationAlertState)
    .values({
      tripId: watch.tripId,
      lastAlertIds: diff.currentIds,
      lastPolledAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tripDestinationAlertState.tripId,
      set: { lastAlertIds: diff.currentIds, lastPolledAt: now, updatedAt: now },
    });

  if (diff.newAlerts.length === 0 || row.tripWeather === false) {
    return { gone: false, notified: false };
  }
  await notifyTripOwner({
    env,
    userId: watch.userId,
    tripId: watch.tripId,
    tripName: watch.name,
    placeName: watch.location.name ?? null,
    newAlerts: diff.newAlerts,
  });
  return { gone: false, notified: true };
}

export type TickResult = {
  /** Alert ids active at the destination, for the next tick's comparison. */
  seenIds: string[];
  /** When to run next; null once the trip needs no more checks. */
  nextAt: number | null;
  notified: boolean;
};

/**
 * One run of a trip's timer. Before the window opens it only reschedules;
 * inside it, it checks the destination's alerts and reaches Postgres only
 * when an alert it hasn't seen appears. With the feature off it keeps time
 * without checking, so turning the flag on needs no re-arm.
 */
export async function tickTripDestination({
  env,
  watch,
  seenIds,
  enabled,
  now,
}: {
  env: ValidatedEnv;
  watch: TripWatch;
  seenIds: string[];
  enabled: boolean;
  now: number;
}): Promise<TickResult> {
  const { opensAt, closesAt } = watchWindow(watch);
  if (now > closesAt) return { seenIds, nextAt: null, notified: false };
  if (now < opensAt) return { seenIds, nextAt: opensAt, notified: false };

  const nextAt = now + POLL_INTERVAL_MS;
  if (!enabled) return { seenIds, nextAt, notified: false };

  const alerts = await fetchCoordinateAlerts(watch.location);
  const diff = diffAlerts({ previousIds: seenIds, currentAlerts: alerts });
  if (diff.newAlerts.length === 0) return { seenIds: diff.currentIds, nextAt, notified: false };

  const delivery = await deliverTripDestinationAlerts({
    env,
    watch,
    alerts,
    now: new Date(now),
  });
  return {
    seenIds: diff.currentIds,
    nextAt: delivery.gone ? null : nextAt,
    notified: delivery.notified,
  };
}
