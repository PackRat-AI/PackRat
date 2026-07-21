import { isBoolean } from '@packrat/guards';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import {
  type FeatureFlagKey,
  type FeatureFlagsMap,
  featureFlagsAtom,
} from 'expo-app/atoms/featureFlagsAtom';
import { appConfig } from 'expo-app/config';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';

export const FEATURE_FLAGS_QUERY_KEY = ['featureFlags', 'config'] as const;

// The known flag keys, typed. Object.keys widens to string[], but the keys of
// the statically-defined config object are exactly FeatureFlagKey.
// safe-cast: keys of a compile-time-known object are its keyof union
const knownFeatureFlagKeys = Object.keys(appConfig.featureFlags) as FeatureFlagKey[];

/**
 * Fetches the effective feature-flag map from the API. Cached for 5 minutes —
 * flags change rarely, and a stale read at worst shows/hides a feature a
 * little late, never crashes anything (every key always has a value: the
 * coded default until the server responds).
 */
function useFeatureFlagsQuery() {
  return useQuery({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: async (): Promise<Record<string, boolean>> => {
      Sentry.addBreadcrumb({
        category: 'featureFlags',
        message: 'Fetching feature-flags config',
        level: 'info',
      });
      try {
        const { data, error } = await apiClient['feature-flags'].get();
        if (error || !data) throw error ?? new Error('Failed to load feature-flags config');
        return data;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'featureFlags', action: 'getConfig' },
        });
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Full effective feature-flag map: server overrides merged over the coded
 * defaults in packages/config. Only known keys are ever applied — an
 * unrecognized or missing key always falls back to its default, so a
 * malformed/partial server response can't accidentally hide a feature.
 *
 * Reads synchronously from a persisted Jotai atom (seeded with the coded
 * defaults), so every call site has a value on the very first render — no
 * loading state to handle. The query updates the atom once it resolves.
 */
export function useFeatureFlags(): FeatureFlagsMap {
  const { data } = useFeatureFlagsQuery();
  const cached = useAtomValue(featureFlagsAtom);
  const setCached = useSetAtom(featureFlagsAtom);

  useEffect(() => {
    if (!data) return;
    // Recompute fresh from the coded defaults on every successful fetch,
    // rather than folding onto the previously cached value, so a flag
    // removed server-side reliably reverts instead of sticking.
    const next: FeatureFlagsMap = { ...appConfig.featureFlags };
    // Iterate the typed known keys, not the server response, so an unrecognized
    // server key can't create a flag and each key is a FeatureFlagKey by type.
    for (const key of knownFeatureFlagKeys) {
      const value = data[key];
      if (isBoolean(value)) next[key] = value;
    }
    setCached(next);
  }, [data, setCached]);

  return cached;
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureFlags()[key];
}
