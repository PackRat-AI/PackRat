import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { TripInStore } from '../types';

const listTrips = async () => {
  const { data, error } = await apiClient.trips.get({ query: { includePublic: 0 } });
  if (error) throw new Error(`Failed to list trips: ${error.value}`);
  return data as object[] | null;
};

const createTrip = async (tripData: TripInStore) => {
  const { data, error } = await apiClient.trips.post(tripData as never);
  if (error) throw new Error(`Failed to create trip: ${error.value}`);
  return data as object | null;
};

const updateTrip = async ({ id, ...data }: Partial<TripInStore>) => {
  const { data: result, error } = await apiClient.trips({ tripId: String(id) }).put(data as never);
  if (error) throw new Error(`Failed to update trip: ${error.value}`);
  return result as object | null;
};

// Observable trips store
export const tripsStore = observable<Record<string, TripInStore>>({});

// Sync trips store with backend
syncObservable(
  tripsStore,
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
      name: 'trips',
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listTrips,
    create: createTrip,
    update: updateTrip,
    changesSince: 'last-sync',
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000);
      return () => clearInterval(intervalId);
    },
  }),
);

// Sync state export
export const tripsSyncState = syncState(tripsStore);

export type TripsStore = typeof tripsStore;
