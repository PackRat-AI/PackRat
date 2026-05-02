import { obs } from '@packrat/app/lib/store';
import { tripsStore } from '@packrat/app/trips/store/trips';
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
