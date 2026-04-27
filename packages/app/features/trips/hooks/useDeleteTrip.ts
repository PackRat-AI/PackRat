import { tripsStore } from 'app/features/trips/store/trips';
import { obs } from 'app/lib/store';
import { useCallback } from 'react';

export function useDeleteTrip() {
  const deleteTrip = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    const tripObs = obs(tripsStore, id);
    if (tripObs) {
      tripObs.deleted.set(true);
    }
  }, []);

  return deleteTrip;
}
