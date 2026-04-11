import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

export interface TripAnalytics {
  totalTrips: number;
  completedTrips: number;
  upcomingTrips: number;
  totalNightsOutdoors: number;
  averageTripDurationDays: number | null;
  longestTripDays: number | null;
  longestTripName: string | null;
  mostActiveMonth: string | null;
  mostActiveMonthCount: number | null;
  tripsByMonth: { month: string; count: number }[];
  locationsVisited: number;
  uniqueRegions: string[];
  currentYearTrips: number;
  lastYearTrips: number;
}

export const fetchTripAnalytics = async (): Promise<TripAnalytics> => {
  try {
    const res = await axiosInstance.get('/api/trips/analytics');
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch trip analytics: ${message}`);
  }
};

const ANALYTICS_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes

interface UseTripAnalyticsOptions {
  enabled?: boolean;
}

export function useTripAnalytics({ enabled = true }: UseTripAnalyticsOptions = {}) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['tripAnalytics'],
    enabled: enabled && isQueryEnabledWithAccessToken,
    queryFn: fetchTripAnalytics,
    staleTime: ANALYTICS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
