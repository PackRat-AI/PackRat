import { isSameDay } from 'date-fns';
import type { Trip } from 'expo-app/features/trips/types';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';

/**
 * The trip a command is about when no trip page says: the one being tracked or guided, otherwise
 * the one in progress that started last, otherwise one starting today, so "start my trip" works.
 */
export function activeTrip({
  trips,
  busyTripIds,
  now,
}: {
  trips: readonly Trip[];
  busyTripIds: readonly string[];
  now: Date;
}): Trip | null {
  const live = trips.filter((trip) => !trip.deleted);
  const busy = live.find((trip) => busyTripIds.includes(trip.id) && trip.status !== 'complete');
  if (busy) return busy;
  const started = live
    .filter((trip) => trip.status === 'in_progress')
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  if (started[0]) return started[0];
  return (
    live.find((trip) => {
      if ((trip.status ?? 'planned') !== 'planned') return false;
      const start = parseLocalDate(trip.startDate ?? undefined);
      return start != null && isSameDay(start, now);
    }) ?? null
  );
}

/** The trip in progress, for safety alerts. */
export function tripInProgress(params: Parameters<typeof activeTrip>[0]): Trip | null {
  const trip = activeTrip(params);
  return trip?.status === 'in_progress' ? trip : null;
}

function sortKey(trip: Trip): string {
  return String(trip.startedAt ?? trip.startDate ?? '');
}
