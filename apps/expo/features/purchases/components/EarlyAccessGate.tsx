import { isInEarlyAccess } from '@packrat/config';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { CustomVariableValue, PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useConnectivity } from '../hooks/useConnectivity';
import { useEntitlement } from '../hooks/useEntitlement';
import { useFeatureAccess, useFeatureAccessConfig } from '../hooks/useFeatureAccess';
import { usePresentPaywall } from '../hooks/usePresentPaywall';
import { isRevenueCatConfigured } from '../lib/revenueCat';

// Prevents concurrent paywall sheets from stacking (e.g. multiple tabs mounting simultaneously).
let isPaywallPresenting = false;

const MAX_FEATURE_SLOTS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days from now until the feature graduates to free for everyone. */
function daysUntilGraduation(earlyAccessUntil: Date | null): number {
  if (!earlyAccessUntil) return 0;
  return Math.max(1, Math.ceil((earlyAccessUntil.getTime() - Date.now()) / DAY_MS));
}

// RevenueCat paywall text templates have no pluralization support, so the
// full "N day(s)" phrase is computed here rather than just the count.
function formatAccessWindow(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}

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
  const { allowed, isLoading, resolved, label, description, earlyAccessUntil } =
    useFeatureAccess(featureKey);
  const { data: allFeatures } = useFeatureAccessConfig();
  const { refetch: refetchEntitlement } = useEntitlement();
  const { presentEarlyAccessPaywall } = usePresentPaywall();
  const connectivity = useConnectivity();
  const router = useRouter();

  // In production RevenueCat is always configured; the only reason it wouldn't
  // be is a local dev build without keys, where we let the feature through so
  // development isn't blocked. In prod this is always true.
  const rcConfigured = isRevenueCatConfigured();
  const devBypass = __DEV__ && !rcConfigured;

  // True cold start with nothing cached (no persisted config or entitlement) and
  // the device is offline: we cannot verify Pro, so we must not present the
  // paywall (which would wrongly gate a subscriber) nor grant access (which
  // would leak a gated feature). Show a "connect to verify" message instead.
  const coldStartOffline = !resolved && connectivity === 'offline';

  useFocusEffect(
    useCallback(() => {
      // Wait until signals are resolved before deciding — never paywall on an
      // unresolved cold start. `isLoading` covers the online block-on-first-fetch.
      if (isLoading || !resolved || allowed || isPaywallPresenting || devBypass) return;

      // Other features currently in early access (excluding this one), up to 4 slots.
      // Paywall V2 has no loop construct so we pass each as a named variable.
      const otherFeatures = (allFeatures ?? [])
        .filter((f) => f.key !== featureKey && isInEarlyAccess(f))
        .slice(0, MAX_FEATURE_SLOTS);

      const slots: Record<string, ReturnType<typeof CustomVariableValue.string>> = {};
      for (let i = 0; i < MAX_FEATURE_SLOTS; i++) {
        slots[`feature_${i + 1}`] = CustomVariableValue.string(otherFeatures[i]?.label ?? 'null');
      }

      const featureName = label ?? featureKey;
      isPaywallPresenting = true;
      presentEarlyAccessPaywall({
        feature_name: CustomVariableValue.string(featureName),
        feature_description: CustomVariableValue.string(
          description ?? `Get early access to ${featureName} today.`,
        ),
        access_window_days: CustomVariableValue.string(
          formatAccessWindow(daysUntilGraduation(earlyAccessUntil)),
        ),
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
      resolved,
      allowed,
      presentEarlyAccessPaywall,
      router,
      devBypass,
      allFeatures,
      featureKey,
      label,
      description,
      earlyAccessUntil,
    ]),
  );

  // Dev build without RevenueCat keys — don't block local development.
  if (devBypass || allowed) {
    return <>{children}</>;
  }

  // Cold start, offline, nothing cached: we genuinely can't verify access.
  // Tell the user rather than guessing — a subscriber gets a clear next step,
  // and a gated feature is never leaked to a free user.
  if (coldStartOffline) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text variant="title3" className="text-center">
          You&apos;re offline
        </Text>
        <Text variant="body" color="secondary" className="text-center">
          We couldn&apos;t verify your access. If you&apos;re subscribed, connect to the internet
          and try again to unlock {label ?? 'this feature'}.
        </Text>
        <Button
          onPress={() => {
            void refetchEntitlement();
          }}
        >
          <Text>Try again</Text>
        </Button>
        {router.canGoBack() && (
          <Button variant="plain" onPress={() => router.back()}>
            <Text>Go back</Text>
          </Button>
        )}
      </View>
    );
  }

  // Signals not yet resolved (online cold start / block-on-first-fetch) or a
  // paywall is about to present — show a spinner, never a wrong decision.
  if (isLoading || !resolved) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
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
