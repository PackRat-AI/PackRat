import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { obs } from 'expo-app/lib/store';
import { nanoid } from 'nanoid';
import type { PackWeightHistoryEntry } from '../types';
import { computePackWeights } from '../utils';
import { packItemsStore } from './packItems';
import { packsStore } from './packs';

/**
 * Web version of packWeightHistory store.
 * Removes expo-sqlite persistence — data is fetched from the API and kept in memory.
 * Metro automatically picks this file over packWeightHistory.ts for web builds.
 */

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
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listPackWeightHistories,
    create: createPackWeightHistoryEntry,
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000);
      return () => clearInterval(intervalId);
    },
  }),
);

export function recordPackWeight(packId: string) {
  const pack = obs(packsStore, packId).peek();
  const packItems = Object.values(packItemsStore.peek()).filter(
    (item) => item.packId === packId && !item.deleted,
  );
  const { totalWeight } = computePackWeights({ ...pack, items: packItems });
  const id = nanoid();

  obs(packWeigthHistoryStore, id).set({
    id,
    packId,
    weight: totalWeight,
    localCreatedAt: new Date().toISOString(),
  });
}

export const packWeigthHistorySyncState = syncState(packWeigthHistoryStore);

export type PackWeigthHistoryStore = typeof packWeigthHistoryStore;
