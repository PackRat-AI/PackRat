import { use$ } from '@legendapp/state/react';
import { tripsStore } from '../store/trips'; // adjust path if needed

export function useTrips() {
  const trips = use$(() => {
    const tripsArray = Object.values(tripsStore.get());

    return tripsArray
      .filter((trip) => trip.deleted === false)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  });

  return trips;
}
