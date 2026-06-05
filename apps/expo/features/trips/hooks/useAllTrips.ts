import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
export const fetchAllTrips = async () => {
  const { data, error } = await apiClient.trips.get();
  if (error) {
    const err = new Error(String(error.value ?? 'Failed to fetch trips'));
    Sentry.captureException(err, {
      tags: { feature: 'trips', action: 'fetchAllTrips' },
      extra: { apiError: error.value, httpStatus: error.status },
    });
    throw err;
  }
  return data ?? [];
};

export function useAllTrips(enabled: boolean) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['allTrips'],
    enabled: isQueryEnabledWithAccessToken && enabled,
    queryFn: fetchAllTrips,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
