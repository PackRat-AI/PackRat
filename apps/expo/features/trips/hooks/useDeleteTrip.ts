import { tripsStore } from 'expo-app/features/trips/store/trips';
import { useCallback } from 'react';

export function useDeleteTrip() {
  const deleteTrip = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    // @ts-expect-error: Safe because Legend-State uses Proxy
    const tripObs = tripsStore[id];
    if (tripObs) {
      tripObs.deleted.set(true);
    }
  }, []);

  return deleteTrip;
}
