import { observable, syncState } from '@legendapp/state';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { syncObservable } from '@legendapp/state/sync';
import Storage from 'expo-sqlite/kv-store';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import type { User } from '../../profile/types';

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
