import { isInEarlyAccess } from '@packrat/config';
import { ActivityIndicator } from '@packrat/ui/nativewindui';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { CustomVariableValue, PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useFeatureAccess, useFeatureAccessConfig } from '../hooks/useFeatureAccess';
import { usePresentPaywall } from '../hooks/usePresentPaywall';
import { isRevenueCatConfigured } from '../lib/revenueCat';

// Prevents concurrent paywall sheets from stacking (e.g. multiple tabs mounting simultaneously).
let isPaywallPresenting = false;

const MAX_FEATURE_SLOTS = 4;

interface EarlyAccessGateProps {
  /** Feature key matching a FeatureFlag / feature_access row. */
  featureKey: string;
  children: React.ReactNode;
}

/**
 * Gates a feature by its early-access state. While the feature is inside its
 * early-access window it behaves like the Pro paywall (Pro members pass,
 * everyone else sees the paywall); once it graduates to free for everyone the
 * gate becomes a no-op and simply renders its children. Unlike the permanent
 * `ProGate`, access here is temporary by design — the feature opens up to all
 * users on its graduation date.
 */
export function EarlyAccessGate({ featureKey, children }: EarlyAccessGateProps) {
  const { allowed, isLoading, label } = useFeatureAccess(featureKey);
  const { data: allFeatures } = useFeatureAccessConfig();
  const { presentEarlyAccessPaywall } = usePresentPaywall();
  const router = useRouter();

  // When RevenueCat isn't configured we can neither verify Pro nor present a
  // paywall, so fail open and render the feature — consistent with the
  // resolver's principle of never wrongly locking a user out.
  const rcConfigured = isRevenueCatConfigured();

  useFocusEffect(
    useCallback(() => {
      if (isLoading || allowed || isPaywallPresenting || !rcConfigured) return;

      // Other features currently in early access (excluding this one), up to 4 slots.
      // Paywall V2 has no loop construct so we pass each as a named variable.
      const otherFeatures = (allFeatures ?? [])
        .filter((f) => f.key !== featureKey && isInEarlyAccess(f))
        .slice(0, MAX_FEATURE_SLOTS);

      const slots: Record<string, ReturnType<typeof CustomVariableValue.string>> = {};
      for (let i = 0; i < MAX_FEATURE_SLOTS; i++) {
        slots[`feature_${i + 1}`] = CustomVariableValue.string(otherFeatures[i]?.label ?? '');
      }

      isPaywallPresenting = true;
      presentEarlyAccessPaywall({
        feature_name: CustomVariableValue.string(label ?? featureKey),
        ...slots,
      })
        .then((result) => {
          if (
            (result === PAYWALL_RESULT.CANCELLED || result === PAYWALL_RESULT.ERROR) &&
            router.canGoBack()
          ) {
            router.back();
          }
        })
        .finally(() => {
          isPaywallPresenting = false;
        });
    }, [
      isLoading,
      allowed,
      presentEarlyAccessPaywall,
      router,
      rcConfigured,
      allFeatures,
      featureKey,
      label,
    ]),
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (allowed || !rcConfigured) {
    return <>{children}</>;
  }

  // Render children invisibly so Stack.Screen mounts and sets the correct header.
  // No visible fallback — the paywall sheet is the only UI shown to gated users.
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, opacity: 0 }} pointerEvents="none">
        {children}
      </View>
      <Stack.Screen
        options={{
          headerSearchBarOptions: null as unknown as undefined,
        }}
      />
    </View>
  );
}
