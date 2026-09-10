import { toRecord } from '@packrat/guards';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PurchasesPackage as Package } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { persistCustomerInfo } from '../lib/customerInfoCache';
import { assertPurchasableIdentity } from '../lib/revenueCat';
import { CUSTOMER_INFO_QUERY_KEY } from './useCustomerInfo';

/**
 * Buys a package. Mirrors `SubscriptionService.purchase(package:)` in Swift,
 * including its anonymous-identity backstop.
 *
 * A user cancelling is reported by the SDK as a rejection carrying
 * `userCancelled`. That is the most ordinary outcome on a paywall, so it is
 * neither reported to Sentry nor surfaced as a failure the caller must
 * special-case — `data.cancelled` says so instead.
 */
export function usePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: Package) => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Initiating purchase',
        level: 'info',
        data: { productId: pkg.product.identifier },
      });

      // A purchase must belong to an account, or the entitlement cannot be
      // resolved to one later. Checked before the store sheet opens so nobody
      // is asked to pay for something we could not attribute. See ADR-006.
      await assertPurchasableIdentity();

      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        void persistCustomerInfo(customerInfo);
        return { customerInfo, cancelled: false as const };
      } catch (error) {
        // Backing out of a purchase is ordinary, not a fault to report.
        if (isUserCancelled(error)) {
          return { customerInfo: null, cancelled: true as const };
        }
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'purchasePackage' },
          extra: { productId: pkg.product.identifier },
        });
        throw error;
      }
    },
    onSuccess: ({ customerInfo }) => {
      // Nothing to apply when the buyer backed out — writing null would
      // clobber a perfectly good cached entitlement.
      if (!customerInfo) return;
      queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, customerInfo);
    },
  });
}

/**
 * Whether a rejection is the buyer dismissing the store sheet.
 *
 * `react-native-purchases` attaches `userCancelled` to the rejected error
 * rather than resolving, so reading that flag is the only way to tell a
 * cancellation from a genuine failure.
 */
function isUserCancelled(error: unknown): boolean {
  return toRecord(error).userCancelled === true;
}
