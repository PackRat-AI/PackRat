import type { Trip } from '@packrat/app/trips';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';

export function useUpdateTrip() {
  const updateTrip = useCallback((trip: Trip) => {
    obs(tripsStore, trip.id).set({
      ...trip,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return updateTrip;
}
