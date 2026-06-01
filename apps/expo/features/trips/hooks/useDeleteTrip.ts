import * as Sentry from '@sentry/react-native';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';

export function useDeleteTrip() {
  const deleteTrip = useCallback(async (id: string) => {
    // Optimistic local flip so the UI hides the trip immediately.
    const tripObs = obs({ store: tripsStore, id });
    if (tripObs) tripObs.deleted.set(true);

    Sentry.addBreadcrumb({
      category: 'trips',
      message: 'Deleting trip',
      level: 'info',
      data: { tripId: id },
    });

    // Two failure modes: a transport rejection (network drop, fetch abort)
    // and a non-2xx response (server still has the trip). In both we need
    // to undo the optimistic flip, capture, and rethrow so the caller can
    // surface it. 404 is treated as success since the trip is already gone.
    try {
      const response = await apiClient.trips({ tripId: id }).delete();
      if (response.error && response.status !== 404) {
        throw new Error(`Trip delete failed (${response.status})`);
      }
    } catch (error) {
      if (tripObs) tripObs.deleted.set(false);
      Sentry.captureException(error, {
        tags: { feature: 'trips', action: 'delete' },
        extra: { tripId: id },
      });
      throw error;
    }
  }, []);

  return deleteTrip;
}
