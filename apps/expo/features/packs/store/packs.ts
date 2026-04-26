import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { PackWithWeightsSchema } from '@packrat/api/schemas/packs';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { PackInStore } from '../types';

const listPacks = async () => {
  const { data, error } = await apiClient.packs.get({ query: { includePublic: 0 } });
  if (error) throw new Error(`Failed to list packs: ${error.value}`);
  return PackWithWeightsSchema.array().parse(data);
};

const createPack = async (packData: PackInStore) => {
  const { data, error } = await apiClient.packs.post({
    id: packData.id,
    name: packData.name,
    description: packData.description ?? undefined,
    category: packData.category ?? undefined,
    isPublic: packData.isPublic,
    image: packData.image,
    tags: packData.tags ?? undefined,
    localCreatedAt: packData.localCreatedAt ?? new Date().toISOString(),
    localUpdatedAt: packData.localUpdatedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to create pack: ${error.value}`);
  return PackWithWeightsSchema.parse(data);
};

const updatePack = async ({ id, ...data }: Partial<PackInStore>) => {
  const { data: result, error } = await apiClient.packs({ packId: String(id) }).put({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description ?? undefined } : {}),
    ...(data.category !== undefined ? { category: data.category ?? undefined } : {}),
    ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
    ...(data.image !== undefined ? { image: data.image } : {}),
    ...(data.tags !== undefined ? { tags: data.tags ?? undefined } : {}),
    ...(data.deleted !== undefined ? { deleted: data.deleted } : {}),
    ...(data.localUpdatedAt ? { localUpdatedAt: data.localUpdatedAt } : {}),
  });
  if (error) throw new Error(`Failed to update pack: ${error.value}`);
  return PackWithWeightsSchema.parse(result);
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
      plugin: observablePersistSqlite(Storage),
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
