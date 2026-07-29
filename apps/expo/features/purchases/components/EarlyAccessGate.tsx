import { isInEarlyAccess } from '@packrat/config';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
 * gate becomes a no-op and simply renders its children. Access here is
 * temporary by design — the feature opens up to all users on its graduation
 * date.
 */
export function EarlyAccessGate({ featureKey, children }: EarlyAccessGateProps) {
  const {
    allowed,
    isLoading,
    resolved,
    unresolvedDueToError,
    label,
    description,
    earlyAccessUntil,
  } = useFeatureAccess(featureKey);
  const { data: allFeatures, refetch: refetchConfig } = useFeatureAccessConfig();
  const { refetch: refetchEntitlement } = useEntitlement();
  const { presentEarlyAccessPaywall } = usePresentPaywall();
  const connectivity = useConnectivity();
  const router = useRouter();

  // Set when we're gated (not Pro) but can't actually present the paywall —
  // offline, so RevenueCat's offerings fetch fails. Without this the gate would
  // sit on the invisible children forever (paywall never opens, no fallback).
  const [paywallUnavailable, setPaywallUnavailable] = useState(false);

  // In production RevenueCat is always configured; the only reason it wouldn't
  // be is a local dev build without keys, where we let the feature through so
  // development isn't blocked. In prod this is always true.
  const rcConfigured = isRevenueCatConfigured();
  const devBypass = __DEV__ && !rcConfigured;

  // True cold start with nothing cached (no persisted config or entitlement) and
  // we can't verify Pro: we must not present the paywall (which would wrongly
  // gate a subscriber) nor grant access (which would leak a gated feature).
  // Show a "connect to verify" message instead.
  //
  // Trigger on either signal, whichever lands first: the connectivity probe
  // reporting `offline`, OR a required fetch having actually failed (which
  // resolves before the probe when the device is offline). Waiting only on the
  // probe would leave the user on a spinner until it settled.
  const cannotVerify = !resolved && (connectivity === 'offline' || unresolvedDueToError);

  // Gated (resolved, not Pro) but offline: the paywall can't load its offerings
  // from RevenueCat, so presenting it would fail silently and strand the user on
  // the invisible children. Show the same fallback instead. (A cached-Pro user
  // is already `allowed` and never reaches here.)
  const gatedButOffline = resolved && !allowed && connectivity === 'offline';
  const showFallback = cannotVerify || gatedButOffline || paywallUnavailable;

  useFocusEffect(
    useCallback(() => {
      // Wait until signals are resolved before deciding — never paywall on an
      // unresolved cold start. `isLoading` covers the online block-on-first-fetch.
      // Don't attempt the paywall when we already know it can't be shown.
      if (isLoading || !resolved || allowed || isPaywallPresenting || devBypass || showFallback) {
        return;
      }

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
          // ERROR here typically means offerings couldn't load (e.g. network
          // dropped mid-present) — fall back to the in-place message rather than
          // leaving the user on the invisible children.
          if (result === PAYWALL_RESULT.ERROR) {
            setPaywallUnavailable(true);
          } else if (result === PAYWALL_RESULT.CANCELLED && router.canGoBack()) {
            router.back();
          }
        })
        .catch(() => {
          // presentEarlyAccessPaywall rejected (offerings fetch threw, offline).
          setPaywallUnavailable(true);
        })
        .finally(() => {
          isPaywallPresenting = false;
        });
    }, [
      isLoading,
      resolved,
      allowed,
      showFallback,
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

  // We can't show the feature and can't show a paywall right now:
  //  - cannotVerify: cold start with nothing cached — we don't know if Pro.
  //  - gatedButOffline / paywallUnavailable: we know this viewer isn't Pro, but
  //    the paywall's offerings can't load offline.
  // Either way, show an in-place message instead of stranding the user on the
  // invisible children. A subscriber gets a clear next step; a gated feature is
  // never leaked to a free user.
  if (showFallback) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text variant="title3" className="text-center">
          {cannotVerify ? "Can't verify your access" : "You're offline"}
        </Text>
        <Text variant="body" color="secondary" className="text-center">
          {cannotVerify
            ? `We couldn't reach our servers. If you're subscribed, connect to the internet and try again to unlock ${label ?? 'this feature'}.`
            : `${label ?? 'This feature'} is in early access for Pro members. Connect to the internet to subscribe or restore your purchase.`}
        </Text>
        <Button
          onPress={() => {
            setPaywallUnavailable(false);
            void refetchEntitlement();
            void refetchConfig();
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
