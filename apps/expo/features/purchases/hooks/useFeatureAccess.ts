import { type FeatureAccessLike, hasFeatureAccess, isInEarlyAccess } from '@packrat/config';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useEntitlement } from './useEntitlement';

export const FEATURE_ACCESS_QUERY_KEY = ['featureAccess', 'config'] as const;

interface FeatureAccessConfigItem extends FeatureAccessLike {
  key: string;
  label: string;
  description: string | null;
}

/**
 * Fetch the global early-access config — the small list of features that are
 * (or recently were) in an early-access window. Cached for 5 minutes; the
 * config changes rarely and a stale read at worst shows the paywall a little
 * early or late, never locks anyone out (the resolver fails open).
 */
export function useFeatureAccessConfig() {
  return useQuery({
    queryKey: FEATURE_ACCESS_QUERY_KEY,
    queryFn: async (): Promise<FeatureAccessConfigItem[]> => {
      Sentry.addBreadcrumb({
        category: 'featureAccess',
        message: 'Fetching feature-access config',
        level: 'info',
      });
      try {
        const { data, error } = await apiClient['feature-access'].get();
        if (error || !data) throw error ?? new Error('Failed to load feature-access config');
        return data;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'featureAccess', action: 'getConfig' },
        });
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface FeatureAccessResult {
  /** Whether the viewer may use the feature right now. */
  allowed: boolean;
  /** Config or entitlement still loading — gate should wait, not paywall. */
  isLoading: boolean;
  /** Feature is in its early-access window (Pro-gated for non-members). */
  isInEarlyAccess: boolean;
  /** When the feature graduates to free for everyone (null = already free). */
  earlyAccessUntil: Date | null;
  /** Human-readable feature name, when configured. */
  label?: string;
  /** Paywall description copy for this feature, when configured. */
  description?: string | null;
}

/**
 * Resolve whether the current viewer may use `key`, combining the global
 * early-access config with their Pro entitlement. A feature with no config row
 * (or one already graduated) is always allowed — the model never gates
 * something that isn't in an active early-access window.
 */
export function useFeatureAccess(key: string): FeatureAccessResult {
  const { data: config, isLoading: configLoading } = useFeatureAccessConfig();
  const { isProMember, isLoading: entitlementLoading } = useEntitlement();

  const feature = config?.find((f) => f.key === key);
  const until = feature?.earlyAccessUntil ? new Date(feature.earlyAccessUntil) : null;

  return {
    allowed: hasFeatureAccess(feature, { hasPro: isProMember }),
    isLoading: configLoading || entitlementLoading,
    isInEarlyAccess: isInEarlyAccess(feature),
    earlyAccessUntil: until,
    label: feature?.label,
    description: feature?.description,
  };
}
