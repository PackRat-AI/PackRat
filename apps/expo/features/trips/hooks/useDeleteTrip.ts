import { tripsStore } from 'expo-app/features/trips/store/trips';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';

export function useDeleteTrip() {
  const deleteTrip = useCallback(async (id: string) => {
    // Optimistic local flip so the UI hides the trip immediately.
    const tripObs = obs({ store: tripsStore, id });
    if (tripObs) tripObs.deleted.set(true);

    // syncedCrud's PUT strips `deleted` (UpdateTripBodySchema doesn't expose
    // it), so the store-only flip never reaches the DB. Fire DELETE.
    const response = await apiClient.trips({ tripId: id }).delete();

    // 404 = already deleted elsewhere, treat as success. Any other non-2xx
    // means the server still has the trip; roll back the optimistic flip
    // so the next list refetch re-renders the row in its real state.
    if (response.error && response.status !== 404) {
      if (tripObs) tripObs.deleted.set(false);
      throw new Error(`Trip delete failed (${response.status})`);
    }
  }, []);

  return deleteTrip;
}
