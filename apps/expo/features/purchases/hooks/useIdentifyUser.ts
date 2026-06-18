import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from 'expo-app/lib/auth-client';
import { useEffect } from 'react';
import Purchases from 'react-native-purchases';
import { isRevenueCatInitialized } from '../lib/init';
import { CUSTOMER_INFO_QUERY_KEY } from './useEntitlement';

export function useIdentifyUser() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!isRevenueCatInitialized()) return;

    if (userId) {
      Purchases.logIn(userId)
        .then(() => queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY }))
        .catch((error: unknown) => {
          Sentry.captureException(error, {
            tags: { feature: 'purchases', action: 'logIn' },
            extra: { userId },
          });
        });
    } else {
      Purchases.logOut()
        .then(() => queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY }))
        .catch((error: unknown) => {
          Sentry.captureException(error, {
            tags: { feature: 'purchases', action: 'logOut' },
          });
        });
    }
  }, [userId, queryClient]);
}
