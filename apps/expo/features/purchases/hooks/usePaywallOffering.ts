import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import Purchases, { type PurchasesOffering } from 'react-native-purchases';
import { isRevenueCatConfigured } from '../lib/revenueCat';
import { PACKRAT_EARLY_ACCESS_OFFERING_ID } from '../types';

export const PAYWALL_OFFERING_QUERY_KEY = ['purchases', 'paywallOffering'] as const;

/** Why the paywall could not be shown, when it could not. */
export type PaywallOfferingFailure =
  /** Our side: no API key in this build, or no offering configured. Retrying
   *  will not help, so the copy must not suggest it. */
  | 'unavailable'
  /** A transient fetch failure, usually the network. Retrying is reasonable. */
  | 'couldNotLoad';

/**
 * Loads the offering the paywall sells, so a paywall only ever opens once there
 * is something to show.
 *
 * Mirrors `SubscriptionService.earlyAccessOffering()` and the load step of
 * `PaywallPresenter` in Swift: prefer the early-access offering, fall back to
 * the current one, and distinguish "nothing is configured" from "we could not
 * reach the store" — because only one of those is worth a retry button.
 */
export function usePaywallOffering(enabled: boolean) {
  const query = useQuery({
    queryKey: PAYWALL_OFFERING_QUERY_KEY,
    enabled: enabled && isRevenueCatConfigured(),
    queryFn: async (): Promise<PurchasesOffering | null> => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Loading paywall offering',
        level: 'info',
      });
      try {
        const offerings = await Purchases.getOfferings();
        // Null rather than throwing: the SDK answered, there is simply nothing
        // configured to sell. That is our misconfiguration, not the viewer's
        // network, and the two want different copy.
        return offerings.all[PACKRAT_EARLY_ACCESS_OFFERING_ID] ?? offerings.current ?? null;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'getPaywallOffering' },
        });
        throw error;
      }
    },
    // Prices change rarely and a paywall that has to wait on a network round
    // trip before painting is a paywall people close.
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const failure: PaywallOfferingFailure | null = !isRevenueCatConfigured()
    ? 'unavailable'
    : query.isError
      ? 'couldNotLoad'
      : query.isSuccess && !query.data
        ? 'unavailable'
        : null;

  return { ...query, offering: query.data ?? null, failure };
}

/** Alert copy for a paywall that could not be opened. */
export const PAYWALL_FAILURE_COPY: Readonly<
  Record<PaywallOfferingFailure, { title: string; message: string }>
> = Object.freeze({
  unavailable: {
    title: 'Upgrades Unavailable',
    message: 'Subscriptions aren’t available right now. Please try again later.',
  },
  couldNotLoad: {
    title: 'Couldn’t Load Plans',
    message: 'Check your connection and try again.',
  },
});
