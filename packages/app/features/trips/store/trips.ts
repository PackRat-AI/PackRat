import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { TripSchema } from '@packrat/api/schemas/trips';
import { isAuthed } from 'app/features/auth/store';
import { apiClient } from 'app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { TripInStore } from '../types';

const listTrips = async () => {
  const { data, error } = await apiClient.trips.get({ query: { includePublic: 0 } });
  if (error) throw new Error(`Failed to list trips: ${error.value}`);
  return TripSchema.array().parse(data);
};

const createTrip = async (tripData: TripInStore) => {
  if (!tripData.location) {
    throw new Error('Trip location is required before sync');
  }
  const { data, error } = await apiClient.trips.post({
    id: tripData.id,
    name: tripData.name,
    location: tripData.location,
    description: tripData.description ?? null,
    notes: tripData.notes ?? null,
    packId: tripData.packId ?? null,
    startDate: tripData.startDate ?? null,
    endDate: tripData.endDate ?? null,
    localCreatedAt: tripData.localCreatedAt ?? new Date().toISOString(),
    localUpdatedAt: tripData.localUpdatedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to create trip: ${error.value}`);
  return TripSchema.parse(data);
};

const updateTrip = async ({ id, ...data }: Partial<TripInStore>) => {
  const { data: result, error } = await apiClient.trips({ tripId: String(id) }).put({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.location !== undefined ? { location: data.location } : {}),
    ...(data.description !== undefined ? { description: data.description ?? null } : {}),
    ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
    ...(data.packId !== undefined ? { packId: data.packId ?? null } : {}),
    ...(data.startDate !== undefined ? { startDate: data.startDate ?? null } : {}),
    ...(data.endDate !== undefined ? { endDate: data.endDate ?? null } : {}),
    ...(data.localUpdatedAt ? { localUpdatedAt: data.localUpdatedAt } : {}),
  });
  if (error) throw new Error(`Failed to update trip: ${error.value}`);
  return TripSchema.parse(result);
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
      plugin: observablePersistSqlite(Storage),
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
