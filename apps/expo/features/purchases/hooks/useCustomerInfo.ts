import * as Sentry from '@sentry/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { persistCustomerInfo, readPersistedCustomerInfo } from '../lib/customerInfoCache';

export const CUSTOMER_INFO_QUERY_KEY = ['purchases', 'customerInfo'] as const;

export function useCustomerInfo() {
  const queryClient = useQueryClient();

  // Whether a persisted customerInfo has been loaded from disk yet. Until this
  // resolves we don't know if the user has a last-known Pro signal, so the gate
  // must wait rather than treat them as not-Pro (see `resolved` below).
  const [persistedLoaded, setPersistedLoaded] = useState(false);
  const [hadPersisted, setHadPersisted] = useState(false);

  // Seed the query cache synchronously-ish from the last-known customerInfo so
  // an offline cold start resolves a Pro signal instead of a transient
  // `undefined`. The live `getCustomerInfo()` (which itself reads the SDK's
  // native cache offline) refreshes it moments later.
  useEffect(() => {
    let cancelled = false;
    readPersistedCustomerInfo().then((info) => {
      if (cancelled) return;
      if (info && !queryClient.getQueryData(CUSTOMER_INFO_QUERY_KEY)) {
        queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, info);
      }
      setHadPersisted(!!info);
      setPersistedLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  // Keep React Query cache and the on-disk copy in sync when RevenueCat emits
  // updates (after a purchase, renewal, or restore from another device).
  useEffect(() => {
    const handler = (info: CustomerInfo) => {
      queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, info);
      void persistCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(handler);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(handler);
    };
  }, [queryClient]);

  const query = useQuery({
    queryKey: CUSTOMER_INFO_QUERY_KEY,
    queryFn: async () => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Fetching customer info',
        level: 'info',
      });
      try {
        const info = await Purchases.getCustomerInfo();
        void persistCustomerInfo(info);
        return info;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'getCustomerInfo' },
        });
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // A Pro signal is "resolved" once we have customerInfo from any source (live
  // fetch or persisted cache), OR once the live fetch has *succeeded* and there
  // is no persisted copy (confirmed: this user has no entitlement).
  //
  // A *failed* fetch with no persisted copy is deliberately NOT resolved: that
  // is "we couldn't check", not "confirmed not-Pro". Resolving it would let a
  // subscriber who is merely offline on a cold start be shown the paywall. The
  // gate treats unresolved-offline as "connect to verify" instead.
  const hasData = query.data !== undefined;
  const fetchSucceededEmpty = query.isSuccess && persistedLoaded && !hadPersisted;
  const resolved = hasData || fetchSucceededEmpty;

  return { ...query, resolved, hadPersisted, persistedLoaded };
}
