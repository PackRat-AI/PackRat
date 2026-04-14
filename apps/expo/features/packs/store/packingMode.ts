import { observable } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import Storage from 'expo-sqlite/kv-store';

export const packingModeStore = observable<Record<string, Record<string, boolean>>>({});

syncObservable(packingModeStore, {
  persist: {
          // legend-state ships a nested copy of expo-sqlite; the two SQLiteStorage

          // classes are structurally identical but nominally different (TS2345). The

          // cast dedupes at the type level until the nested dep is hoisted out.

          // biome-ignore lint/suspicious/noExplicitAny: duplicate expo-sqlite install — see comment above

          plugin: observablePersistSqlite(Storage as any),
    retrySync: true,
    name: 'packingMode',
  },
});

export type PackingModeStore = typeof packingModeStore;
