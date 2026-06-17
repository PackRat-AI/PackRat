import { observable, syncState } from '@legendapp/state';
import { synced, syncObservable } from '@legendapp/state/sync';
import type { UserPreferences } from '@packrat/schemas/users';
import * as Sentry from '@sentry/react-native';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import { persistPlugin } from 'expo-app/lib/persist-plugin';

export const PREFERENCES_PERSIST_KEY = 'userPreferences';

export const preferencesStore = observable<UserPreferences>({});

syncObservable(
  preferencesStore,
  synced({
    persist: {
      plugin: persistPlugin,
      name: PREFERENCES_PERSIST_KEY,
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000,
    },
    get: async () => {
      const { data, error } = await apiClient.user.preferences.get();
      if (error) {
        Sentry.captureException(error, {
          tags: { feature: 'preferences', action: 'get' },
        });
        throw new Error(String(error.value));
      }
      return data?.preferences ?? {};
    },
    set: async ({ value }) => {
      const { error } = await apiClient.user.preferences.patch(value);
      if (error) {
        Sentry.captureException(error, {
          tags: { feature: 'preferences', action: 'set' },
        });
        throw new Error(String(error.value));
      }
    },
  }),
);

export const preferencesSyncState = syncState(preferencesStore);
