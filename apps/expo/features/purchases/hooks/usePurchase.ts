import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Package } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { CUSTOMER_INFO_QUERY_KEY } from './useCustomerInfo';

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
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return customerInfo;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'purchasePackage' },
          extra: { productId: pkg.product.identifier },
        });
        throw error;
      }
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, customerInfo);
    },
  });
}
