import { use$ } from '@legendapp/state/react';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import { obs } from 'expo-app/lib/store';

/**
 * Retrieves a trip from the store.
 * Use this hook for user-owned trips to observe live changes.
 *
 * @param id - The id of the trip to retrieve
 * @returns A trip object with its items and computed stats
 */
export function useTripDetailsFromStore(id: string) {
  const trip = use$(() => {
    const trip_ = obs(tripsStore, id).get();

    return trip_;
  });

  return trip;
}
