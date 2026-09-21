import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useConnectivity } from '../hooks/useConnectivity';
import { useEntitlement } from '../hooks/useEntitlement';
import { useFeatureAccess, useFeatureAccessConfig } from '../hooks/useFeatureAccess';
import { isRevenueCatConfigured } from '../lib/revenueCat';

// Prevents concurrent paywall pushes from stacking (e.g. multiple tabs
// mounting simultaneously, or a focus effect re-running mid-navigation).
let isPaywallPresenting = false;

interface EarlyAccessGateProps {
  /** Feature key matching a FeatureFlag / feature_access row. */
  featureKey: string;
  children: React.ReactNode;
}

/**
 * Gates a feature by its early-access state. Mirrors `EarlyAccessGate` in
 * `apps/swift/Sources/PackRat/Subscriptions/EarlyAccessGate.swift`.
 *
 * While the feature sits inside its early-access window, Pro members pass and
 * everyone else is sent to the paywall. Once the window graduates the gate
 * becomes a no-op and simply renders its children, so nothing has to be
 * flipped a second time.
 *
 * # The states, in the order they are decided
 *
 * 1. **Unresolved** — signals have not landed yet. Shows a spinner and never a
 *    decision, because guessing either way is wrong: paywalling a subscriber is
 *    as bad as leaking a gated feature.
 * 2. **Cannot verify** — nothing cached and the fetch failed, so Pro status is
 *    genuinely unknown. Shows "Can't verify your access" with a retry.
 * 3. **Gated** — resolved, and this viewer is not Pro. Pushes the paywall.
 * 4. **Allowed** — renders the feature.
 *
 * Guests reach the paywall too: it shows them the offer, and its call to action
 * routes them to sign-in. Bouncing someone out with no explanation reads as a
 * bug — see ADR-006.
 */
export function EarlyAccessGate({ featureKey, children }: EarlyAccessGateProps) {
  const { allowed, isLoading, resolved, unresolvedDueToError, label } =
    useFeatureAccess(featureKey);
  const { refetch: refetchConfig } = useFeatureAccessConfig();
  const { refetch: refetchEntitlement } = useEntitlement();
  const connectivity = useConnectivity();
  const router = useRouter();

  // Set when we're gated (not Pro) but can't actually present the paywall —
  // offline, so the offerings fetch fails. Without this the gate would sit on
  // the invisible children forever (paywall never opens, no fallback).
  const [paywallUnavailable, setPaywallUnavailable] = useState(false);

  // In production RevenueCat is always configured; the only reason it wouldn't
  // be is a local dev build without keys, where we let the feature through so
  // development isn't blocked. In prod this is always true.
  const rcConfigured = isRevenueCatConfigured();
  const devBypass = __DEV__ && !rcConfigured;

  // True cold start with nothing cached and we can't verify Pro: we must not
  // present the paywall (which would wrongly gate a subscriber) nor grant
  // access (which would leak a gated feature). Show "connect to verify".
  //
  // Trigger on either signal, whichever lands first: the connectivity probe
  // reporting `offline`, OR a required fetch having actually failed (which
  // resolves before the probe when the device is offline). Waiting only on the
  // probe would leave the user on a spinner until it settled.
  const cannotVerify = !resolved && (connectivity === 'offline' || unresolvedDueToError);

  // Gated (resolved, not Pro) but offline: the paywall can't load its offerings,
  // so pushing it would strand the user on a spinner. Show the same fallback.
  // (A cached-Pro user is already `allowed` and never reaches here.)
  const gatedButOffline = resolved && !allowed && connectivity === 'offline';
  const showFallback = cannotVerify || gatedButOffline || paywallUnavailable;

  useFocusEffect(
    useCallback(() => {
      // Wait until signals are resolved before deciding — never paywall on an
      // unresolved cold start. Don't attempt the paywall when we already know
      // it can't be shown.
      if (isLoading || !resolved || allowed || isPaywallPresenting || devBypass || showFallback) {
        return;
      }

      // The paywall owns its own copy and loads its own offering; the gate
      // hands it only the feature it was holding back. Everything the paywall
      // says about that feature is resolved there, from the same config this
      // gate read, so the two can never disagree.
      isPaywallPresenting = true;
      router.push({ pathname: '/paywall', params: { featureKey } });

      return () => {
        isPaywallPresenting = false;
      };
    }, [isLoading, resolved, allowed, showFallback, devBypass, featureKey, router]),
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
  // No visible fallback — the paywall is the only UI shown to gated users.
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
