import { use$ } from '@legendapp/state/react';
import { useQueryClient } from '@tanstack/react-query';
import { userStore } from 'expo-app/features/auth/store';
import { useEffect, useRef } from 'react';
import { clearPersistedCustomerInfo, persistCustomerInfo } from '../lib/customerInfoCache';
import { identifyRevenueCatUser, resetRevenueCatUser } from '../lib/revenueCat';
import { CUSTOMER_INFO_QUERY_KEY } from './useCustomerInfo';

/**
 * Keeps the RevenueCat user identity in sync with the app's auth state.
 * Call this once at the app root after RevenueCat is configured.
 *
 * Mirrors the identity handling in Swift's `SubscriptionService.identify` /
 * `resetUser` plus `FeatureAccessStore.forgetEntitlement`.
 */
export function useRevenueCatUser() {
  const user = use$(userStore);
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = user?.id ?? null;

    // First run establishes the baseline. Nothing has *changed* yet, so the
    // cached entitlement is still the right one to be serving.
    const isFirstRun = previousUserId.current === undefined;
    const identityChanged = !isFirstRun && previousUserId.current !== userId;
    previousUserId.current = userId;

    // Entitlement is cached per device but belongs to an account. Without
    // dropping it the moment the identity changes, the next person on a shared
    // device inherits the previous one's Pro until a fetch succeeds — and
    // offline, that fetch may never come. Fail closed: an unknown viewer is
    // not Pro.
    if (identityChanged) {
      queryClient.removeQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY });
      void clearPersistedCustomerInfo();
    }

    if (userId) {
      void identifyRevenueCatUser(userId).then((customerInfo) => {
        if (!customerInfo) return;
        // `logIn` already merged any anonymous purchases onto this account, so
        // this result is authoritative. Applying it now is what lets a guest
        // who subscribed and then signed up keep what they paid for without
        // waiting on the next refresh.
        queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, customerInfo);
        void persistCustomerInfo(customerInfo);
      });
    } else {
      void resetRevenueCatUser();
    }
  }, [user?.id, queryClient]);
}
