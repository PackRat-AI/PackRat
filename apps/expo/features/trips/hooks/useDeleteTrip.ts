import { tripsStore } from 'expo-app/features/trips/store/trips';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';

export function useDeleteTrip() {
  const deleteTrip = useCallback(async (id: string) => {
    // Optimistically flip `deleted` in the local store so the UI hides the
    // trip immediately.
    const tripObs = obs({ store: tripsStore, id });
    if (tripObs) {
      tripObs.deleted.set(true);
    }
    // syncedCrud's PUT path strips the `deleted` field (UpdateTripBodySchema
    // doesn't expose it), so a store-only flip never reaches the database
    // and the next GET /api/trips returns the trip again. Fire DELETE
    // explicitly — the trips route already supports soft-delete via DELETE.
    await apiClient.trips({ tripId: id }).delete();
  }, []);

  return deleteTrip;
}
