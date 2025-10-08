import { tripsStore } from 'expo-app/features/trips/store/trips';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import type { TripInput, TripInStore } from '../types';

// Hook to create a trip
export function useCreateTrip() {
  const createTrip = useCallback((tripData: TripInput) => {
    const id = nanoid();
    const timestamp = new Date().toISOString();
    console.log("Creating trip with id:", id, timestamp);

    const newTrip: TripInStore = {
      id,
      ...tripData,
      localCreatedAt: timestamp,
      localUpdatedAt: timestamp,
      deleted: false,
    };
    // @ts-ignore: Safe because Legend-State uses Proxy
    tripsStore[id].set(newTrip);

    return id;
  }, []);

  return createTrip;
}
