import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { persistPlugin } from '@packrat/app/lib/persist-plugin';
import type { User } from '@packrat/app/profile';

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
