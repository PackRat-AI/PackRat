import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import type { User } from 'expo-app/features/profile/types';
import Storage from 'expo-sqlite/kv-store';

export const userStore = observable<User | null>(null);

syncObservable(
  userStore,
  syncedCrud({
    persist: {
      name: 'user',
      plugin: observablePersistSqlite(Storage),
    },
  }),
);

export const userSyncState = syncState(userStore);

export type UserStore = typeof userStore;
