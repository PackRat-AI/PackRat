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
 * (or recently were) in an early-access window. Cached for 5 minutes and
 * persisted to disk (see TanstackProvider) so it resolves offline. The config
 * changes rarely; a stale read at worst shows the paywall a little early or
 * late. Gating itself is resolved by `hasFeatureAccess` against the viewer's
 * Pro entitlement — an in-window feature stays gated for non-Pro viewers.
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
  /**
   * Whether both signals (early-access config and the Pro entitlement) are
   * resolved from some source — live or persisted. `false` only on a true cold
   * start with nothing cached: the gate must then show an offline/verify
   * message rather than either granting access or flashing the paywall.
   */
  resolved: boolean;
  /**
   * A required signal failed to load and there was no cached copy to fall back
   * on (i.e. unresolved *because* a fetch errored, not merely still in flight).
   * Lets the gate show the offline/verify message immediately, without waiting
   * for the separate connectivity probe to report `offline`.
   */
  unresolvedDueToError: boolean;
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
  const {
    data: config,
    isLoading: configLoading,
    isSuccess: configResolved,
    isError: configError,
  } = useFeatureAccessConfig();
  const {
    isProMember,
    isLoading: entitlementLoading,
    resolved: entitlementResolved,
    isError: entitlementError,
  } = useEntitlement();

  const feature = config?.find((f) => f.key === key);
  const until = feature?.earlyAccessUntil ? new Date(feature.earlyAccessUntil) : null;

  // With the AsyncStorage persister, `configResolved` (isSuccess) is true as
  // soon as the persisted config is restored, so an offline launch resolves the
  // config without a network round-trip.
  const resolved = configResolved && entitlementResolved;

  // Unresolved specifically because a fetch failed with no cache to fall back
  // on — a definite "couldn't verify" that the gate can act on immediately,
  // rather than waiting for the connectivity probe.
  const unresolvedDueToError = !resolved && (configError || entitlementError);

  return {
    allowed: hasFeatureAccess(feature, { hasPro: isProMember }),
    isLoading: configLoading || entitlementLoading,
    resolved,
    unresolvedDueToError,
    isInEarlyAccess: isInEarlyAccess(feature),
    earlyAccessUntil: until,
    label: feature?.label,
    description: feature?.description,
  };
}
