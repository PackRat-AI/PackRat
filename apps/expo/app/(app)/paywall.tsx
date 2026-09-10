import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { appAlert } from 'expo-app/app/_layout';
import { PackRatPaywall } from 'expo-app/features/purchases/components/PackRatPaywall';
import { useFeatureAccessConfig } from 'expo-app/features/purchases/hooks/useFeatureAccess';
import {
  PAYWALL_FAILURE_COPY,
  usePaywallOffering,
} from 'expo-app/features/purchases/hooks/usePaywallOffering';
import { otherEarlyAccessFeatureNames } from 'expo-app/features/purchases/utils/earlyAccessFeatures';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

/**
 * The paywall screen — PackRat's own, not RevenueCat's template.
 *
 * Reached from Settings' *Upgrade to Pro* (no feature, a general upgrade) and
 * from `EarlyAccessGate` (carrying the gated feature, so the paywall can speak
 * to what the viewer was reaching for).
 *
 * The offering loads first and the paywall only opens once there is something
 * to sell. When it cannot be loaded the viewer is returned where they came from
 * with a short alert, rather than being left on an empty screen — the same
 * behaviour as Swift's `PaywallPresenter`.
 */
export default function PaywallRoute() {
  const router = useRouter();
  const { featureKey } = useLocalSearchParams<{ featureKey?: string }>();

  const { offering, isLoading, failure } = usePaywallOffering(true);
  const { data: allFeatures } = useFeatureAccessConfig();

  // A failure closes the screen, and closing it must happen once. Without this
  // the alert re-fires on every render while the route unwinds.
  const hasReportedFailure = useRef(false);

  useEffect(() => {
    if (!failure || hasReportedFailure.current) return;
    hasReportedFailure.current = true;

    const copy = PAYWALL_FAILURE_COPY[failure];
    appAlert.current?.alert({ ...copy, buttons: [{ text: 'OK', style: 'default' }] });
    router.back();
  }, [failure, router]);

  const feature = featureKey ? allFeatures?.find((f) => f.key === featureKey) : undefined;
  const featureName = featureKey ? feature?.label?.trim() || featureKey : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      {offering ? (
        <PackRatPaywall
          offering={offering}
          featureName={featureName}
          otherEarlyAccessFeatures={otherEarlyAccessFeatureNames(allFeatures, {
            excludingKey: featureKey ?? null,
          })}
          onDismiss={() => router.back()}
          onEntitlementChanged={() => router.back()}
        />
      ) : (
        // Loading, or unwinding after a failure. A bare spinner on the
        // paywall's own backdrop rather than the app's, so there is no flash of
        // a differently-coloured screen before the paywall paints.
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgb(8, 10, 10)',
          }}
        >
          {isLoading && <ActivityIndicator size="large" />}
        </View>
      )}
    </>
  );
}
