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
      // biome-ignore lint/suspicious/noExplicitAny: Storage type mismatch with legend-state plugin
      // biome-ignore lint/suspicious/noExplicitAny: expo-sqlite/kv-store and legend-state's persistence-plugin types don't align; the cast is load-bearing until both sides converge
      plugin: observablePersistSqlite(Storage as any),
    },
  }),
);

export const userSyncState = syncState(userStore);

export type UserStore = typeof userStore;
