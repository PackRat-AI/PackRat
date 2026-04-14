import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';
import Storage from 'expo-sqlite/kv-store';
import { nanoid } from 'nanoid/non-secure';
import type { PackWeightHistoryEntry } from '../types';
import { computePackWeights } from '../utils';
import { packItemsStore } from './packItems';
import { packsStore } from './packs';

const listPackWeightHistories = async () => {
  const { data, error } = await apiClient.packs['weight-history'].get();
  if (error) throw new Error(`Failed to list packWeightHistories: ${error.value}`);
  return data as object[] | null;
};

const createPackWeightHistoryEntry = async (packWeightHistoryEntry: PackWeightHistoryEntry) => {
  const { data, error } = await apiClient
    .packs({ packId: String(packWeightHistoryEntry.packId) })
    ['weight-history'].post(packWeightHistoryEntry as never);
  if (error) throw new Error(`Failed to create packWeightHistoryEntry: ${error.value}`);
  return data as object | null;
};

export const packWeigthHistoryStore = observable<Record<string, PackWeightHistoryEntry>>({});

syncObservable(
  packWeigthHistoryStore,
  syncedCrud({
    fieldCreatedAt: 'createdAt',
    mode: 'merge',
    persist: {
      // legend-state ships a nested copy of expo-sqlite; the two SQLiteStorage
      // classes are structurally identical but nominally different (TS2345). The
      // cast dedupes at the type level until the nested dep is hoisted out.
      // biome-ignore lint/suspicious/noExplicitAny: duplicate expo-sqlite install — see comment above
      plugin: observablePersistSqlite(Storage as any),
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
