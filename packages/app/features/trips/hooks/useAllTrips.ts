import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { Trip } from '../types';

// Fetch all trips for the current user
export const fetchAllTrips = async (): Promise<Trip[]> => {
  try {
    const res = await axiosInstance.get('/api/trips');
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    console.error('Failed to fetch all trips:', error);
    throw new Error(message);
  }
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
