import { tripsStore } from 'expo-app/features/trips/store/trips';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';

export function useDeleteTrip() {
  const deleteTrip = useCallback(async (id: string) => {
    // Optimistically mark as deleted in the local store so the UI updates immediately
    const tripObs = obs({ store: tripsStore, id });
    if (tripObs) {
      tripObs.deleted.set(true);
    }
    // Hard-delete on the server so the list GET won't return the trip on any subsequent reload
    await apiClient.trips({ tripId: id }).delete();
  }, []);

  return deleteTrip;
}
