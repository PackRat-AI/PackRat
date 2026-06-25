import { useSelector } from '@legendapp/state/react';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { userStore } from 'expo-app/features/auth/store/user';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { useEffect, useRef, useState } from 'react';
import { trailConditionReportsStore } from '../store/trailConditionReports';
import type { TrailConditionReport } from '../types';

const CACHE_KEY_PREFIX = 'trail_condition_reports_cache';

function cacheKey({ userId, trailName }: { userId: string; trailName?: string }): string {
  const base = `${CACHE_KEY_PREFIX}:${userId}`;
  return trailName ? `${base}:${trailName}` : base;
}

/** Persist fetched reports to AsyncStorage for offline / cold-start access. */
async function writeCachedReports({
  reports,
  opts,
}: {
  reports: TrailConditionReport[];
  opts: { userId: string; trailName?: string };
}) {
  try {
    await AsyncStorage.setItem(
      cacheKey({ userId: opts.userId, trailName: opts.trailName }),
      safeJsonStringify(reports),
    );
  } catch {
    // Best-effort — swallow write errors silently
  }
}

/** Read previously-cached reports from AsyncStorage. */
async function readCachedReports(opts: {
  userId: string;
  trailName?: string;
}): Promise<TrailConditionReport[] | undefined> {
  try {
    const raw = await AsyncStorage.getItem(
      cacheKey({ userId: opts.userId, trailName: opts.trailName }),
    );
    // safe-cast: JSON.parse returns unknown; data was written as TrailConditionReport[] earlier
    if (raw) return safeJsonParse(raw, { strict: true }) as TrailConditionReport[];
  } catch {
    // Corrupt or missing cache — ignore
  }
  return undefined;
}

export const fetchTrailConditionReports = async (
  trailName?: string,
): Promise<TrailConditionReport[]> => {
  const { data, error } = await apiClient['trail-conditions'].get({
    query: { limit: 50, ...(trailName ? { trailName } : {}) },
  });
  if (error) {
    console.error('Failed to fetch trail condition reports:', error.value);
    const err = new Error(`Failed to fetch trail condition reports: ${String(error.value)}`);
    Sentry.captureException(err, {
      tags: { feature: 'trailConditions', action: 'fetchReports' },
      extra: { trailName, apiError: error.value, httpStatus: error.status },
    });
    throw err;
  }
  // safe-cast: treaty response shape matches TrailConditionReport[] as validated by the API schema
  return (data ?? []) as unknown as TrailConditionReport[];
};

export function useTrailConditionReports(trailName?: string) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  // Scope disk cache by current user so switching accounts on the same device
  // does not leak the previous user's seed data into the new session.
  const currentUserId = useSelector(() => {
    const user = userStore.get();
    const id = user?.id;
    return id != null ? String(id) : 'anon';
  });

  // Read locally-stored reports (user's own, offline-persisted) as fallback
  const localReports = useSelector(() => {
    const store = trailConditionReportsStore.get();
    // safe-cast: Legend-State observable record values are typed as TrailConditionReport
    return Object.values(store).filter((r) => !r.deleted) as TrailConditionReport[];
  });

  // Load disk-cached community reports on mount for offline / cold-start access
  const [cachedReports, setCachedReports] = useState<TrailConditionReport[] | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setCachedReports(undefined);
    readCachedReports({ userId: currentUserId, trailName }).then((reports) => {
      if (!cancelled) setCachedReports(reports);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, trailName]);

  // Pick the best offline seed: disk cache (community) > local store (own reports)
  const offlineSeed = cachedReports ?? (localReports.length > 0 ? localReports : undefined);

  const query = useQuery({
    queryKey: ['trailConditionReports', currentUserId, trailName],
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
      writeCachedReports({ reports: query.data, opts: { userId: currentUserId, trailName } });
    }
  }, [query.data, query.isFetched, currentUserId, trailName]);

  return query;
}
