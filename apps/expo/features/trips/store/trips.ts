import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import Storage from 'expo-sqlite/kv-store';
import type { TripInStore } from '../types';

// API calls for trips
const listTrips = async () => {
  try {
    const res = await axiosInstance.get('/api/trips');
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to list trips: ${message}`);
  }
};

const createTrip = async (tripData: TripInStore) => {
  try {
    const res = await axiosInstance.post('/api/trips', tripData);
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to create trip: ${message}`);
  }
};

const updateTrip = async ({ id, ...data }: Partial<TripInStore>) => {
  try {
    const res = await axiosInstance.put(`/api/trips/${id}`, data);
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to update trip: ${message}`);
  }
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
