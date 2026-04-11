import { observable } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import Storage from 'expo-sqlite/kv-store';

export const packingModeStore = observable<Record<string, Record<string, boolean>>>({});

syncObservable(packingModeStore, {
  persist: {
    // biome-ignore lint/suspicious/noExplicitAny: legacy type
    plugin: observablePersistSqlite(Storage as any),
    retrySync: true,
    name: 'packingMode',
  },
});

export type PackingModeStore = typeof packingModeStore;
