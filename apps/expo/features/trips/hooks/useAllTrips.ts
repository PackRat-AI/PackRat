import { useQuery } from '@tanstack/react-query';
import { rpcClient } from 'expo-app/lib/api/rpcClient';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

// Fetch all trips for the current user
export const fetchAllTrips = async () => {
  const res = await rpcClient.api.trips.$get({
    query: {},
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch all trips: ${res.status}`);
  }
  return res.json();
};

// Hook to query trips
export function useAllTrips(enabled: boolean) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['allTrips'],
    enabled: isQueryEnabledWithAccessToken && enabled,
    queryFn: fetchAllTrips,
    staleTime: 1000 * 60 * 5, // 5 min
    refetchOnWindowFocus: false,
  });
}
