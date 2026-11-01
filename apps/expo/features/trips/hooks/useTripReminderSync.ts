import { use$ } from '@legendapp/state/react';
import { safeJsonStringify } from '@packrat/utils';
import * as Sentry from '@sentry/react-native';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { getPackItems } from 'expo-app/features/packs/store/packItems';
import { packingModeStore } from 'expo-app/features/packs/store/packingMode';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { setTripConditionsRefreshEnabled } from '../lib/tripConditionsBackgroundRefresh';
import { refreshTripConditions, syncTripReminders } from '../lib/tripReminderScheduler';
import { tripConditionsStore, tripReminderSettingsStore } from '../store/tripReminders';
import { tripsStore } from '../store/trips';
import type { Trip } from '../types';
import { conditionsSourceKey } from '../utils/tripConditions';

/**
 * Changes whenever a trip's reminders would: added, removed, re-dated, re-linked
 * to another pack, packed further, Before-you-go list changed, forecast
 * refreshed, or switched off.
 */
function useReminderSignature(): string {
  return use$(() => {
    const settings = tripReminderSettingsStore.get();
    const packing = packingModeStore.get();
    const conditions = tripConditionsStore.get();
    const trips = Object.values(tripsStore.get()).filter((trip) => !trip.deleted);
    return safeJsonStringify([
      settings,
      trips.map((trip) => [
        trip.id,
        trip.name,
        conditionsSourceKey(trip),
        trip.packId ?? '',
        trip.checklist ?? [],
        conditions[trip.id]?.fetchedAt ?? 0,
        trip.packId ? getPackItems(trip.packId).map((item) => [item.id, item.name]) : [],
        trip.packId ? (packing[trip.packId] ?? {}) : {},
      ]),
    ]);
  });
}

function currentTrips(): Trip[] {
  return Object.values(tripsStore.peek()).filter((trip) => !trip.deleted);
}

/**
 * Mount once inside the signed-in app. Keeps this device's pending pre-trip
 * reminders in step with trips, packing progress and the destination forecast:
 * on launch, whenever any of them change, and each time the app is foregrounded
 * or backgrounded — so a reminder carries the packing the user just did.
 */
export function useTripReminderSync({ isAuthed }: { isAuthed: boolean }) {
  const featureEnabled = useFeatureFlag('enableTripReminders');
  const { unit } = useTemperatureUnit();
  const signature = useReminderSignature();
  const celsius = unit === 'C';
  // Syncs run one at a time so a cancel never lands between another sync's schedules.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const run = useRef<(refreshForecast: boolean) => void>(() => {});

  run.current = (refreshForecast: boolean) => {
    queue.current = queue.current.then(async () => {
      try {
        if (featureEnabled && refreshForecast) {
          await refreshTripConditions({ trips: currentTrips() });
        }
        await syncTripReminders({ trips: currentTrips(), celsius, featureEnabled });
      } catch (error) {
        // Swallowed so one failed sync doesn't stall the queue for every later one.
        Sentry.captureException(error, { tags: { feature: 'tripReminders', action: 'sync' } });
      }
    });
  };

  useEffect(() => {
    setTripConditionsRefreshEnabled(isAuthed && featureEnabled);
  }, [isAuthed, featureEnabled]);

  useEffect(() => {
    if (!isAuthed) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') run.current(state === 'active');
    });
    return () => subscription.remove();
  }, [isAuthed]);

  // A refreshed forecast changes the signature, so this re-runs once more and
  // then settles: the refresh is throttled per trip.
  useEffect(() => {
    if (isAuthed) run.current(true);
  }, [isAuthed, featureEnabled, celsius, signature]);
}
