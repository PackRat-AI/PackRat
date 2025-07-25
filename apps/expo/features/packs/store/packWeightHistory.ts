import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import Storage from 'expo-sqlite/kv-store';
import { nanoid } from 'nanoid/non-secure';
import type { PackWeightHistoryEntry } from '../types';
import { computePackWeights } from '../utils';
import { packItemsStore } from './packItems';
import { packsStore } from './packs';

const listPackWeightHistories = async () => {
  try {
    const res = await axiosInstance.get('/api/packs/weight-history');
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to list packWeightHistories: ${message}`);
  }
};
const createPackWeightHistoryEntry = async (packWeightHistoryEntry: PackWeightHistoryEntry) => {
  try {
    const response = await axiosInstance.post(
      `/api/packs/${packWeightHistoryEntry.packId}/weight-history`,
      packWeightHistoryEntry,
    );
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to create packWeightHistoryEntry: ${message}`);
  }
};

export const packWeigthHistoryStore = observable<Record<string, PackWeightHistoryEntry>>({});

syncObservable(
  packWeigthHistoryStore,
  syncedCrud({
    fieldCreatedAt: 'createdAt',
    mode: 'merge',
    persist: {
      plugin: observablePersistSqlite(Storage),
      retrySync: true,
      name: 'packWeigthHistory',
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true, // Keep retrying until it saves
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listPackWeightHistories,
    create: createPackWeightHistoryEntry,
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

export function recordPackWeight(packId: string) {
  const pack = packsStore[packId].peek();
  const packItems = Object.values(packItemsStore.peek()).filter(
    (item) => item.packId === packId && !item.deleted,
  );
  const { totalWeight } = computePackWeights({ ...pack, items: packItems });
  const id = nanoid();

  packWeigthHistoryStore[id].set({
    id,
    packId,
    weight: totalWeight,
    localCreatedAt: new Date().toISOString(),
  });
}

export const packWeigthHistorySyncState = syncState(packWeigthHistoryStore);

export type PackWeigthHistoryStore = typeof packWeigthHistoryStore;
