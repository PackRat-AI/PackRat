import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { PackItemSchema, PackWithWeightsSchema } from '@packrat/api/schemas/packs';
import { isAuthed } from 'app/features/auth/store';
import { apiClient } from 'app/lib/api/packrat';
import ImageCacheManager from 'app/lib/utils/ImageCacheManager';
import Storage from 'expo-sqlite/kv-store';
import type { PackItem } from '../types';
import { uploadImage } from '../utils';

const listAllPackItems = async (): Promise<PackItem[] | null> => {
  const { data, error } = await apiClient.packs.get({ query: { includePublic: 0 } });
  if (error) throw new Error(`Failed to list packitems: ${error.value}`);
  return (
    PackWithWeightsSchema.array()
      .parse(data)
      // safe-cast: Zod parse validates the shape; PackItem extends the Zod-inferred type
      .flatMap((pack) => pack.items ?? []) as unknown as PackItem[]
  );
};

const createPackItem = async ({ packId, ...data }: PackItem): Promise<PackItem | null> => {
  if (data.image) {
    await uploadImage(data.image, `${ImageCacheManager.cacheDirectory}${data.image}`);
  }
  const { data: result, error } = await apiClient
    .packs({ packId: String(packId) })
    .items.post(data);
  if (error) throw new Error(`Failed to create pack item: ${error.value}`);
  // safe-cast: Zod parse validates the shape; PackItem extends the Zod-inferred type
  return PackItemSchema.parse(result) as unknown as PackItem;
};

const updatePackItem = async ({ id, ...data }: PackItem): Promise<PackItem | null> => {
  if (data.image) {
    await uploadImage(data.image, `${ImageCacheManager.cacheDirectory}${data.image}`);
  }
  const { data: result, error } = await apiClient.packs.items({ itemId: String(id) }).patch(data);
  if (error) throw new Error(`Failed to update pack item: ${error.value}`);
  // safe-cast: Zod parse validates the shape; PackItem extends the Zod-inferred type
  return PackItemSchema.parse(result) as unknown as PackItem;
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
