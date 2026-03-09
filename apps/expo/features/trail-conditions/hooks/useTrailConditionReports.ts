import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { TrailConditionReport } from '../types';

export const fetchTrailConditionReports = async (
  trailName?: string,
): Promise<TrailConditionReport[]> => {
  try {
    const params = trailName ? { trailName } : {};
    const res = await axiosInstance.get('/api/trail-conditions', { params });
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    console.error('Failed to fetch trail condition reports:', error);
    throw new Error(message);
  }
};

export function useTrailConditionReports(trailName?: string) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['trailConditionReports', trailName],
    enabled: isQueryEnabledWithAccessToken,
    queryFn: () => fetchTrailConditionReports(trailName),
    staleTime: 1000 * 60 * 5, // 5 min
    refetchOnWindowFocus: false,
  });
}
