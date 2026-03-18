import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { TrailCondition } from '../types';

export const fetchTrailConditions = async (): Promise<TrailCondition[]> => {
  try {
    const res = await axiosInstance.get('/api/trail-conditions');
    return res.data?.items ?? res.data ?? [];
  } catch (error) {
    const { message } = handleApiError(error);
    console.error('Failed to fetch trail conditions:', error);
    throw new Error(message);
  }
};

export function useTrailConditions() {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['trailConditions'],
    enabled: isQueryEnabledWithAccessToken,
    queryFn: fetchTrailConditions,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
