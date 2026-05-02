import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { persistPlugin } from '@packrat/app/lib/persist-plugin';

export const packingModeStore = observable<Record<string, Record<string, boolean>>>({});

syncObservable(packingModeStore, {
  persist: {
    plugin: persistPlugin,
    retrySync: true,
    name: 'packingMode',
  },
});

export type PackingModeStore = typeof packingModeStore;
