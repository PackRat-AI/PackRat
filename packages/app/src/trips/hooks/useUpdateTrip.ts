import { obs } from '@packrat/app/lib/store';
import type { Trip } from '@packrat/app/trips';
import { tripsStore } from '@packrat/app/trips/store/trips';
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
