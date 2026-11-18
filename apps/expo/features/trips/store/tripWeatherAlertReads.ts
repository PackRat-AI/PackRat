import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import { obs } from 'expo-app/lib/store';

/**
 * Which destination alerts the user has seen on each trip, so the trip list
 * marks only an alert that arrived since they last opened the trip. Same
 * unread rule as a saved location's card (docs/features/weather-alerts.md
 * ADR-010), keyed by trip.
 */
export const tripWeatherAlertReadsStore = observable<Record<string, Record<string, true>>>({});

syncObservable(tripWeatherAlertReadsStore, {
  persist: { plugin: persistPlugin, name: 'tripWeatherAlertReads' },
});

/** True when the trip carries an alert the user hasn't seen on it yet. */
export function hasUnreadTripAlert({
  seen,
  alertIds,
}: {
  seen: Record<string, true> | undefined;
  alertIds: readonly string[];
}): boolean {
  return alertIds.some((id) => !seen?.[id]);
}

/** Records every alert now shown on the trip as seen. */
export function markTripAlertsSeen({
  tripId,
  alertIds,
}: {
  tripId: string;
  alertIds: readonly string[];
}): void {
  const entry = obs({ store: tripWeatherAlertReadsStore, id: tripId });
  const current = entry.peek() ?? {};
  const unseen = alertIds.filter((id) => !current[id]);
  if (unseen.length === 0) return;
  entry.set({ ...current, ...Object.fromEntries(unseen.map((id) => [id, true as const])) });
}
