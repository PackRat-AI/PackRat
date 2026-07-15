import { PACKRAT_PRO_ENTITLEMENT } from '../types';
import { useCustomerInfo } from './useCustomerInfo';

export function useEntitlement() {
  const { data: customerInfo, isLoading, error, refetch, resolved } = useCustomerInfo();

  const isProMember = !!customerInfo?.entitlements.active[PACKRAT_PRO_ENTITLEMENT];

  return {
    isProMember,
    isLoading,
    error,
    refetch,
    // Whether we have a definite Pro signal (live or persisted). False only on a
    // true cold start with no cached entitlement — the gate must not treat that
    // as "not Pro"; it shows an offline/verify message instead of the paywall.
    resolved,
  };
}
