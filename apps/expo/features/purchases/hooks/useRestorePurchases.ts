import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';
import { CUSTOMER_INFO_QUERY_KEY } from './useCustomerInfo';

export function useRestorePurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Restoring purchases',
        level: 'info',
      });
      try {
        return await Purchases.restorePurchases();
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'restorePurchases' },
        });
        throw error;
      }
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, customerInfo);
    },
  });
}
