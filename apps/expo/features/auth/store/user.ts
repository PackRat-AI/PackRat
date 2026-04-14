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
            // legend-state ships a nested copy of expo-sqlite; the two SQLiteStorage
            // classes are structurally identical but nominally different (TS2345). The
            // cast dedupes at the type level until the nested dep is hoisted out.
            // biome-ignore lint/suspicious/noExplicitAny: duplicate expo-sqlite install — see comment above
            plugin: observablePersistSqlite(Storage as any),
    },
  }),
);

export const userSyncState = syncState(userStore);

export type UserStore = typeof userStore;
