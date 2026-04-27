import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
export const fetchAllTrips = async () => {
  const { data, error } = await apiClient.trips.get();
  if (error) throw new Error(`Failed to fetch trips: ${error.value}`);
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
