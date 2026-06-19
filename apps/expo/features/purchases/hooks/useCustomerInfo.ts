import * as Sentry from '@sentry/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

export const CUSTOMER_INFO_QUERY_KEY = ['purchases', 'customerInfo'] as const;

export function useCustomerInfo() {
  const queryClient = useQueryClient();

  // Keep React Query cache in sync when RevenueCat emits updates (e.g. after
  // a successful purchase, subscription renewal, or restore from another device).
  useEffect(() => {
    const handler = (info: CustomerInfo) => {
      queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, info);
    };
    Purchases.addCustomerInfoUpdateListener(handler);
    return () => Purchases.removeCustomerInfoUpdateListener(handler);
  }, [queryClient]);

  return useQuery({
    queryKey: CUSTOMER_INFO_QUERY_KEY,
    queryFn: async () => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Fetching customer info',
        level: 'info',
      });
      try {
        return await Purchases.getCustomerInfo();
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'getCustomerInfo' },
        });
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}
