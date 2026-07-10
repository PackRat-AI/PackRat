import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  CUSTOMER_INFO_QUERY_KEY,
  PACKRAT_EARLY_ACCESS_OFFERING_ID,
} from 'expo-app/features/purchases';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import Purchases, { type PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

export default function PaywallRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [offering, setOffering] = useState<PurchasesOffering | undefined>();

  useEffect(() => {
    Purchases.getOfferings()
      .then((offerings) => {
        setOffering(offerings.all[PACKRAT_EARLY_ACCESS_OFFERING_ID] ?? undefined);
      })
      .catch((error) => {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'getOfferingsPaywallScreen' },
        });
      });
  }, []);

  const handlePurchaseCompleted: React.ComponentProps<
    typeof RevenueCatUI.Paywall
  >['onPurchaseCompleted'] = ({ customerInfo }) => {
    queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, customerInfo);
    Sentry.addBreadcrumb({
      category: 'purchases',
      message: 'Purchase completed from paywall screen',
      level: 'info',
    });
    router.back();
  };

  const handleRestoreCompleted: React.ComponentProps<
    typeof RevenueCatUI.Paywall
  >['onRestoreCompleted'] = ({ customerInfo }) => {
    queryClient.setQueryData(CUSTOMER_INFO_QUERY_KEY, customerInfo);
    Sentry.addBreadcrumb({
      category: 'purchases',
      message: 'Purchases restored from paywall screen',
      level: 'info',
    });
    router.back();
  };

  const handleError: React.ComponentProps<typeof RevenueCatUI.Paywall>['onPurchaseError'] = ({
    error,
  }) => {
    Sentry.captureException(error, {
      tags: { feature: 'purchases', action: 'paywallScreenPurchase' },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <RevenueCatUI.Paywall
        style={{ flex: 1 }}
        options={{ offering }}
        onPurchaseCompleted={handlePurchaseCompleted}
        onRestoreCompleted={handleRestoreCompleted}
        onPurchaseError={handleError}
        onDismiss={() => router.back()}
      />
    </>
  );
}
