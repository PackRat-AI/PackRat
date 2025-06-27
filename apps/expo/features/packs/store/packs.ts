import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import Storage from 'expo-sqlite/kv-store';
import { type PackInStore } from '../types';

const listPacks = async () => {
  try {
    const res = await axiosInstance.get('/api/packs');
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to list packs: ${message}`);
  }
};
const createPack = async (packData: PackInStore) => {
  try {
    const response = await axiosInstance.post('/api/packs', packData);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to create pack: ${message}`);
  }
};

const updatePack = async ({ id, ...data }: Partial<PackInStore>) => {
  try {
    const response = await axiosInstance.put(`/api/packs/${id}`, data);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to update pack: ${message}`);
  }
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
      infinite: true, // Keep retrying until it saves
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
      }, 30000); // 30 seconds interval

      return () => {
        clearInterval(intervalId);
      };
    },
  }),
);

export const packsSyncState = syncState(packsStore);

export type PacksStore = typeof packsStore;
