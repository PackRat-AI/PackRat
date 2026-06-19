import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { PACKRAT_PRO_ENTITLEMENT } from '../types';
import { CUSTOMER_INFO_QUERY_KEY } from './useCustomerInfo';

export function usePresentPaywall() {
  const queryClient = useQueryClient();

  const presentPaywall = useCallback(async () => {
    Sentry.addBreadcrumb({
      category: 'purchases',
      message: 'Presenting paywall',
      level: 'info',
    });
    try {
      const result = await RevenueCatUI.presentPaywall();
      if (result !== PAYWALL_RESULT.NOT_PRESENTED && result !== PAYWALL_RESULT.ERROR) {
        // Invalidate customer info so entitlement state refreshes
        await queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY });
      }
      return result;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'purchases', action: 'presentPaywall' },
      });
      throw error;
    }
  }, [queryClient]);

  // Presents the paywall only if the user lacks the Pro entitlement.
  const presentPaywallIfNeeded = useCallback(async () => {
    Sentry.addBreadcrumb({
      category: 'purchases',
      message: 'Presenting paywall if needed',
      level: 'info',
    });
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: PACKRAT_PRO_ENTITLEMENT,
      });
      if (result !== PAYWALL_RESULT.NOT_PRESENTED && result !== PAYWALL_RESULT.ERROR) {
        await queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY });
      }
      return result;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'purchases', action: 'presentPaywallIfNeeded' },
      });
      throw error;
    }
  }, [queryClient]);

  return { presentPaywall, presentPaywallIfNeeded };
}
