import { observable } from '@legendapp/state';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import axiosInstance, { handleApiError } from '~/lib/api/client';
import { syncObservable } from '@legendapp/state/sync';
import Storage from 'expo-sqlite/kv-store';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { Pack } from '../types';
import { isAuthed } from '~/features/auth/store';

const listPacks = async () => {
  try {
    const res = await axiosInstance.get('/api/packs');
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to list packs: ${message}`);
  }
};
const createPack = async (packData: Omit<Pack, 'items'>) => {
  try {
    const response = await axiosInstance.post('/api/packs', packData);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to create pack: ${message}`);
  }
};

const updatePack = async ({ id, ...data }: Omit<Pack, 'items'>) => {
  try {
    const response = await axiosInstance.put(`/api/packs/${id}`, data);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to update pack: ${message}`);
  }
};

export const packsStore = observable<Record<string, Omit<Pack, 'items'>>>({});

syncObservable(
  packsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
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
  })
);

// Type for the packs store
export type PacksStore = typeof packsStore;
