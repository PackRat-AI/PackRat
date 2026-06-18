import { useQuery, useQueryClient } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';
import { ENTITLEMENT_PRO } from '../lib/config';
import { isRevenueCatInitialized } from '../lib/init';

export const CUSTOMER_INFO_QUERY_KEY = ['customerInfo'] as const;

export function useEntitlement() {
  const queryClient = useQueryClient();

  const {
    data: customerInfo,
    isLoading,
    error,
  } = useQuery({
    queryKey: CUSTOMER_INFO_QUERY_KEY,
    queryFn: () => Purchases.getCustomerInfo(),
    enabled: isRevenueCatInitialized(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const isPro =
    isRevenueCatInitialized() &&
    typeof customerInfo?.entitlements.active[ENTITLEMENT_PRO] !== 'undefined';

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY });
  }

  return { isPro, customerInfo, isLoading, error, invalidate };
}
