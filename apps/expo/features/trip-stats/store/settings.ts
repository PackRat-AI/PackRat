import { observable, syncState } from '@legendapp/state';
import { synced, syncObservable } from '@legendapp/state/sync';
import { type TripStatsSettings, TripStatsSettingsSchema } from '@packrat/schemas/tripStats';
import * as Sentry from '@sentry/react-native';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import { persistPlugin } from 'expo-app/lib/persist-plugin';

/**
 * Why the user was away, for the comeback card. `enabled` is the retired opt-in: Trip Stats
 * shows to everyone, so it is passed through untouched and never read.
 */
export const tripStatsSettingsStore = observable<TripStatsSettings>({
  enabled: null,
  breakReason: null,
  breakReasonTripId: null,
});

syncObservable(
  tripStatsSettingsStore,
  synced({
    persist: { plugin: persistPlugin, retrySync: true, name: 'tripStatsSettings' },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: { infinite: true, backoff: 'exponential', maxDelay: 30000 },
    get: async () => {
      const { data, error } = await apiClient['trip-stats'].settings.get();
      if (error) {
        Sentry.captureException(error, { tags: { feature: 'tripStats', action: 'getSettings' } });
        throw new Error(String(error.value));
      }
      return TripStatsSettingsSchema.parse(data);
    },
    set: async ({ value }) => {
      // A full replace, as on Swift.
      const { error } = await apiClient['trip-stats'].settings.put({
        enabled: value.enabled ?? null,
        breakReason: value.breakReason ?? null,
        breakReasonTripId: value.breakReasonTripId ?? null,
      });
      if (error) {
        Sentry.captureException(error, { tags: { feature: 'tripStats', action: 'putSettings' } });
        throw new Error(String(error.value));
      }
    },
  }),
);

export const tripStatsSettingsSyncState = syncState(tripStatsSettingsStore);
