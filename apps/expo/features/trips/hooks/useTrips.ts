import { use$ } from '@legendapp/state/react';
import { tripsStore } from '../store/trips'; // adjust path if needed

export function useTrips() {
  const trips = use$(() => {
    const tripsArray = Object.values(tripsStore.get());

    // Only include trips that are not deleted
    return tripsArray.filter((trip) => trip.deleted === false);
  });

  return trips;
}
