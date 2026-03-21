import { tripsStore } from 'expo-app/features/trips/store/trips';
import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';
import type { Trip } from '../types';

export function useUpdateTrip() {
  const updateTrip = useCallback((trip: Trip) => {
    obs(tripsStore, trip.id).set({
      ...trip,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return updateTrip;
}
