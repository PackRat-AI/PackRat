import { observable } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import Storage from 'expo-sqlite/kv-store';
import type { OfflineMapRegion } from '../types';

export const offlineMapsStore = observable<Record<string, OfflineMapRegion>>({});

syncObservable(offlineMapsStore, {
  persist: {
    plugin: observablePersistSqlite(Storage),
    retrySync: true,
    name: 'offlineMaps',
  },
});

export type OfflineMapsStore = typeof offlineMapsStore;
