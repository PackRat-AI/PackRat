import { useQueryClient } from '@tanstack/react-query';
import { FEATURE_ACCESS_QUERY_KEY } from 'expo-app/features/purchases/hooks/useFeatureAccess';
import { FEATURE_FLAGS_QUERY_KEY } from 'expo-app/hooks/useFeatureFlags';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Re-fetches feature flags and feature access whenever the app returns to the
 * foreground.
 *
 * Cold launch alone is not enough. Phones are rarely relaunched — an app can
 * sit backgrounded for days — so a flag flipped in the admin panel, an
 * early-access window closing, or a subscription bought on another device
 * would not reach the app until the process was killed and started again.
 *
 * Both queries carry a 5-minute `staleTime`, so a quick app-switch away and
 * back does not refetch; this invalidates them, which asks React Query to
 * refetch the ones currently mounted rather than forcing a network call
 * regardless. A failure leaves the previous data in place, which is why
 * repeating these is safe.
 *
 * Scoped to these two query keys rather than wiring React Query's
 * `focusManager`: that would change refetch behaviour for every query in the
 * app, which is a much larger decision than keeping feature state current.
 */
export function useRefreshFeatureStatesOnForeground(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      // Access first: it decides who may use a feature, and is the one that
      // changes without us — a subscription bought elsewhere, or a lapse.
      queryClient.invalidateQueries({ queryKey: FEATURE_ACCESS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY });
    });

    return () => subscription.remove();
  }, [queryClient]);
}
