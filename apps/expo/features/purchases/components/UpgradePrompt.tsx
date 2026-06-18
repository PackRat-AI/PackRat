import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useEntitlement } from '../hooks/useEntitlement';
import { ENTITLEMENT_PRO, PRO_FEATURES } from '../lib/config';

export function UpgradePrompt() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { invalidate } = useEntitlement();
  const [isPresentingPaywall, setIsPresentingPaywall] = useState(false);

  async function handleViewPlans() {
    setIsPresentingPaywall(true);
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_PRO,
      });

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        invalidate();
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'purchases', action: 'presentPaywall' },
      });
    } finally {
      setIsPresentingPaywall(false);
    }
  }

  async function handleRestore() {
    setIsPresentingPaywall(true);
    try {
      await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_PRO,
      });
      invalidate();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'purchases', action: 'restore' },
      });
    } finally {
      setIsPresentingPaywall(false);
    }
  }

  return (
    <ScrollView
      contentContainerClassName="flex-grow items-center justify-center p-6"
      className="flex-1 bg-background"
    >
      <View className="w-full max-w-sm">
        <View className="mb-6 items-center">
          <View
            className="mb-4 h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Text style={{ fontSize: 40 }}>🎒</Text>
          </View>

          <Text variant="largeTitle" className="text-center font-bold">
            {t('purchases.upgradeTitle')}
          </Text>

          <Text variant="body" className="mt-2 text-center text-muted-foreground">
            {t('purchases.upgradeSubtitle')}
          </Text>
        </View>

        <View className="mb-8 gap-3 rounded-2xl bg-card p-5">
          {PRO_FEATURES.map((feature) => (
            <View key={feature.id} className="flex-row items-center gap-3">
              <View
                className="h-5 w-5 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-xs font-bold text-white">✓</Text>
              </View>
              <Text variant="body">{feature.label}</Text>
            </View>
          ))}
        </View>

        <Button
          onPress={handleViewPlans}
          disabled={isPresentingPaywall}
          className="mb-3 w-full"
          size="lg"
        >
          {isPresentingPaywall ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="font-semibold text-primary-foreground">
              {t('purchases.viewPlans')}
            </Text>
          )}
        </Button>

        <Button variant="plain" onPress={handleRestore} disabled={isPresentingPaywall}>
          <Text className="text-sm text-muted-foreground">{t('purchases.restorePurchases')}</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
