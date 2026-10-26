import { NearbyPeakSchema } from '@packrat/schemas/tripStats';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { BoundingBox } from '../utils/peakSuggestions';

async function getNearbyPeaks(box: BoundingBox) {
  const { data, error } = await apiClient['trip-stats'].peaks.nearby.get({ query: box });
  if (error) {
    const err = new Error(String(error.value ?? 'Failed to load nearby peaks'));
    Sentry.captureException(err, {
      tags: { feature: 'tripStats', action: 'nearbyPeaks' },
      extra: { ...box, httpStatus: error.status, apiError: error.value },
    });
    throw err;
  }
  return NearbyPeakSchema.array().parse(data);
}

/** Named peaks in the box, highest first. The API edge-caches each box for a week. */
export function useNearbyPeaks(box: BoundingBox | null) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();
  return useQuery({
    queryKey: ['nearbyPeaks', box],
    queryFn: () => (box ? getNearbyPeaks(box) : Promise.resolve([])),
    enabled: isQueryEnabledWithAccessToken && box != null,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
