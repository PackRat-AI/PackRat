import { obs } from '@packrat/app/lib/store';
import type { TripInput, TripInStore } from '@packrat/app/trips';
import { tripsStore } from '@packrat/app/trips/store/trips';
import { nanoid } from 'nanoid';
import { useCallback } from 'react';

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
