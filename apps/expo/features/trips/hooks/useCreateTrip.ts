import { tripsStore } from 'expo-app/features/trips/store/trips';
import { obs } from 'expo-app/lib/store';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import type { TripInput, TripInStore } from '../types';

// Hook to create a trip
export function useCreateTrip() {
  const createTrip = useCallback((tripData: TripInput) => {
    const id = nanoid();
    const timestamp = new Date().toISOString();

    const newTrip: TripInStore = {
      id,
      ...tripData,
      localCreatedAt: timestamp,
      localUpdatedAt: timestamp,
      deleted: false,
    };
    obs(tripsStore, id).set(newTrip);

    return id;
  }, []);

  return createTrip;
}
