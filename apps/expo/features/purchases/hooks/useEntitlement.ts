import { PACKRAT_PRO_ENTITLEMENT } from '../types';
import { useCustomerInfo } from './useCustomerInfo';

export function useEntitlement() {
  const {
    data: customerInfo,
    isLoading,
    isPending,
    fetchStatus,
    error,
    refetch,
  } = useCustomerInfo();

  const isProMember = !!customerInfo?.entitlements.active[PACKRAT_PRO_ENTITLEMENT];

  return { isProMember, isLoading, isPending, fetchStatus, error, refetch };
}
