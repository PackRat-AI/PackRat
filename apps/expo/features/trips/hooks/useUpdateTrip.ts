import { tripsStore } from 'expo-app/features/trips/store/trips';
import { useCallback } from 'react';
import type { Trip } from '../types';

export function useUpdateTrip() {
  const updateTrip = useCallback((trip: Trip) => {
    // @ts-ignore: Safe because Legend-State uses Proxy
    tripsStore[trip.id].set({
      ...trip,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return updateTrip;
}
