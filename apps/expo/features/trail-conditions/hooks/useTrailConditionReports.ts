import { useSelector } from '@legendapp/state/react';
import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { trailConditionReportsStore } from '../store/trailConditionReports';
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

  // Read locally-stored reports (user's own, offline-persisted) as initial data
  const localReports = useSelector(() => {
    const store = trailConditionReportsStore.get();
    return Object.values(store).filter((r) => !r.deleted) as TrailConditionReport[];
  });

  return useQuery({
    queryKey: ['trailConditionReports', trailName],
    enabled: isQueryEnabledWithAccessToken,
    queryFn: () => fetchTrailConditionReports(trailName),
    staleTime: 1000 * 60 * 5, // 5 min
    refetchOnWindowFocus: false,
    // Seed with locally-persisted reports (user's own) so the list is readable
    // offline and after restart. Network success replaces this with community data.
    initialData: localReports.length > 0 ? localReports : undefined,
    initialDataUpdatedAt: 0, // treat as stale so a network fetch still runs when online
  });
}
