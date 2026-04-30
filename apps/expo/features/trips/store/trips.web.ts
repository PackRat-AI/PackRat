import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import type { TripInStore } from '../types';

/**
 * Web version of trips store.
 * Removes expo-sqlite persistence — data is fetched from the API and kept in memory.
 * Metro automatically picks this file over trips.ts for web builds.
 */

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

export const tripsStore = observable<Record<string, TripInStore>>({});

syncObservable(
  tripsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    mode: 'merge',
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
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000);
      return () => clearInterval(intervalId);
    },
  }),
);

export const tripsSyncState = syncState(tripsStore);

export type TripsStore = typeof tripsStore;
