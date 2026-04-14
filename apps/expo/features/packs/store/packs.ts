import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { PackInStore } from '../types';

const listPacks = async () => {
  const { data, error } = await apiClient.packs.get({ query: { includePublic: 0 } });
  if (error) throw new Error(`Failed to list packs: ${error.value}`);
  return data as object[] | null;
};

const createPack = async (packData: PackInStore) => {
  const { data, error } = await apiClient.packs.post(packData as never);
  if (error) throw new Error(`Failed to create pack: ${error.value}`);
  return data as object | null;
};

const updatePack = async ({ id, ...data }: Partial<PackInStore>) => {
  const { data: result, error } = await apiClient.packs({ packId: String(id) }).put(data as never);
  if (error) throw new Error(`Failed to update pack: ${error.value}`);
  return result as object | null;
};

export const packsStore = observable<Record<string, PackInStore>>({});

syncObservable(
  packsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    mode: 'merge',
    persist: {
      // legend-state ships a nested copy of expo-sqlite; the two SQLiteStorage
      // classes are structurally identical but nominally different (TS2345). The
      // cast dedupes at the type level until the nested dep is hoisted out.
      // biome-ignore lint/suspicious/noExplicitAny: duplicate expo-sqlite install — see comment above
      plugin: observablePersistSqlite(Storage as any),
      retrySync: true,
      name: 'packs',
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listPacks,
    create: createPack,
    update: updatePack,
    changesSince: 'last-sync',
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000);

      return () => {
        clearInterval(intervalId);
      };
    },
  }),
);

export const packsSyncState = syncState(packsStore);

export type PacksStore = typeof packsStore;
