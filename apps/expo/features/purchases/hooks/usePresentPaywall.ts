import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { type CustomVariables, PAYWALL_RESULT } from 'react-native-purchases-ui';
import { PACKRAT_EARLY_ACCESS_OFFERING_ID, PACKRAT_PRO_ENTITLEMENT } from '../types';
import { CUSTOMER_INFO_QUERY_KEY } from './useCustomerInfo';

export function usePresentPaywall() {
  const queryClient = useQueryClient();

  const presentPaywall = useCallback(
    async (customVariables?: CustomVariables) => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Presenting paywall',
        level: 'info',
      });
      try {
        const result = await RevenueCatUI.presentPaywall({ customVariables });
        if (result !== PAYWALL_RESULT.NOT_PRESENTED && result !== PAYWALL_RESULT.ERROR) {
          await queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY });
        }
        return result;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'presentPaywall' },
        });
        throw error;
      }
    },
    [queryClient],
  );

  // Presents the paywall only if the user lacks the Pro entitlement.
  const presentPaywallIfNeeded = useCallback(
    async (customVariables?: CustomVariables) => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Presenting paywall if needed',
        level: 'info',
      });
      try {
        const result = await RevenueCatUI.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: PACKRAT_PRO_ENTITLEMENT,
          customVariables,
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
    },
    [queryClient],
  );

  // Fetches the earlyaccessmodel offering then presents its paywall sheet.
  // Separate from presentPaywall so the default offering is never clobbered.
  const presentEarlyAccessPaywall = useCallback(
    async (customVariables?: CustomVariables) => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Presenting early-access paywall',
        level: 'info',
      });
      try {
        const offerings = await Purchases.getOfferings();
        console.log('[RC] available offering keys:', Object.keys(offerings.all));
        const offering = offerings.all[PACKRAT_EARLY_ACCESS_OFFERING_ID] ?? undefined;
        console.log(
          '[RC] earlyaccessmodel offering:',
          offering?.identifier ?? 'NOT FOUND — falling back to default',
        );
        const result = await RevenueCatUI.presentPaywall({ offering, customVariables });
        if (result !== PAYWALL_RESULT.NOT_PRESENTED && result !== PAYWALL_RESULT.ERROR) {
          await queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY });
        }
        return result;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'presentEarlyAccessPaywall' },
        });
        throw error;
      }
    },
    [queryClient],
  );

  return { presentPaywall, presentPaywallIfNeeded, presentEarlyAccessPaywall };
}
