import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import type { User } from 'expo-app/features/profile/types';
import { persistPlugin } from 'expo-app/lib/persist-plugin';

export const userStore = observable<User | null>(null);

syncObservable(
  userStore,
  syncedCrud({
    persist: {
      name: 'user',
      plugin: persistPlugin,
    },
  }),
);

export const userSyncState = syncState(userStore);

export type UserStore = typeof userStore;
