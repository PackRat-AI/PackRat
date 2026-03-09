import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from '@legendapp/state/react';
import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { useEffect, useRef, useState } from 'react';
import { trailConditionReportsStore } from '../store/trailConditionReports';
import type { TrailConditionReport } from '../types';

const CACHE_KEY_PREFIX = 'trail_condition_reports_cache';

function cacheKey(trailName?: string): string {
  return trailName ? `${CACHE_KEY_PREFIX}:${trailName}` : CACHE_KEY_PREFIX;
}

/** Persist fetched reports to AsyncStorage for offline / cold-start access. */
async function writeCachedReports(reports: TrailConditionReport[], trailName?: string) {
  try {
    await AsyncStorage.setItem(cacheKey(trailName), JSON.stringify(reports));
  } catch {
    // Best-effort — swallow write errors silently
  }
}

/** Read previously-cached reports from AsyncStorage. */
async function readCachedReports(trailName?: string): Promise<TrailConditionReport[] | undefined> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(trailName));
    if (raw) return JSON.parse(raw) as TrailConditionReport[];
  } catch {
    // Corrupt or missing cache — ignore
  }
  return undefined;
}

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

  // Read locally-stored reports (user's own, offline-persisted) as fallback
  const localReports = useSelector(() => {
    const store = trailConditionReportsStore.get();
    return Object.values(store).filter((r) => !r.deleted) as TrailConditionReport[];
  });

  // Load disk-cached community reports on mount for offline / cold-start access
  const [cachedReports, setCachedReports] = useState<TrailConditionReport[] | undefined>(undefined);
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    readCachedReports(trailName).then(setCachedReports);
  }, [trailName]);

  // Pick the best offline seed: disk cache (community) > local store (own reports)
  const offlineSeed = cachedReports ?? (localReports.length > 0 ? localReports : undefined);

  const query = useQuery({
    queryKey: ['trailConditionReports', trailName],
    enabled: isQueryEnabledWithAccessToken,
    queryFn: () => fetchTrailConditionReports(trailName),
    staleTime: 1000 * 60 * 5, // 5 min
    refetchOnWindowFocus: false,
    // Seed with offline data so the list is readable after restart or when offline.
    // Network success replaces this with fresh community data.
    initialData: offlineSeed,
    initialDataUpdatedAt: 0, // treat as stale so a network fetch still runs when online
  });

  // Persist successful API responses to disk for next cold start
  const prevDataRef = useRef<TrailConditionReport[] | undefined>(undefined);
  useEffect(() => {
    if (query.data && query.data !== prevDataRef.current && query.isFetched) {
      prevDataRef.current = query.data;
      writeCachedReports(query.data, trailName);
    }
  }, [query.data, query.isFetched, trailName]);

  return query;
}
