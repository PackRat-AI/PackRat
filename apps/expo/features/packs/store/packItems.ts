import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isRemoteUrl } from '@packrat/guards';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import Storage from 'expo-sqlite/kv-store';
import type { Pack, PackItem } from '../types';
import { uploadImage } from '../utils';

const listAllPackItems = async () => {
  const { data, error } = await apiClient.packs.get({ query: { includePublic: 0 } });
  if (error) throw new Error(`Failed to list packitems: ${error.value}`);
  return ((data as unknown as Pack[]) ?? []).flatMap((pack) => pack.items) as object[];
};

const createPackItem = async ({ packId, ...data }: PackItem) => {
  if (data.image && !isRemoteUrl(data.image)) {
    await uploadImage(data.image, `${ImageCacheManager.cacheDirectory}${data.image}`);
  }
  const { data: result, error } = await apiClient
    .packs({ packId: String(packId) })
    .items.post(data);
  if (error) throw new Error(`Failed to create pack item: ${error.value}`);
  return result as object | null;
};

const updatePackItem = async ({ id, ...data }: PackItem) => {
  if (data.image && !isRemoteUrl(data.image)) {
    await uploadImage(data.image, `${ImageCacheManager.cacheDirectory}${data.image}`);
  }
  const { data: result, error } = await apiClient.packs.items({ itemId: String(id) }).patch(data);
  if (error) throw new Error(`Failed to update pack item: ${error.value}`);
  return result as object | null;
};

export const packItemsStore = observable<Record<string, PackItem>>({});

syncObservable(
  packItemsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    updatePartial: true,
    mode: 'merge',
    persist: {
      plugin: observablePersistSqlite(Storage),
      retrySync: true,
      name: 'packItems',
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true, // Keep retrying until it saves
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listAllPackItems,
    create: createPackItem,
    update: updatePackItem,
    changesSince: 'last-sync',
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000); // 30 seconds interval

      return () => {
        clearInterval(intervalId);
      };
    },
  }),
);

export function getPackItems(id: string) {
  return Object.values(packItemsStore.get()).filter((item) => item.packId === id && !item.deleted);
}

export const packItemsSyncState = syncState(packItemsStore);

export type PackItemsStore = typeof packItemsStore;
