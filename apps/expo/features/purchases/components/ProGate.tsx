import { ActivityIndicator } from '@packrat/ui/nativewindui';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useEntitlement } from '../hooks/useEntitlement';
import { usePresentPaywall } from '../hooks/usePresentPaywall';

// Prevents concurrent paywall sheets from stacking (e.g. multiple tabs mounting simultaneously).
let isPaywallPresenting = false;

interface ProGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProGate({ children, fallback }: ProGateProps) {
  const { isProMember, isLoading } = useEntitlement();
  const { presentPaywall } = usePresentPaywall();
  const router = useRouter();

  // useFocusEffect only fires for the currently focused screen — background tabs
  // stay silent on app open. React Navigation v6 runs this after every render
  // (no internal dep array), so loading-completion-while-focused is also handled.
  useFocusEffect(
    useCallback(() => {
      if (isLoading || isProMember || isPaywallPresenting) return;

      isPaywallPresenting = true;
      presentPaywall()
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
    }, [isLoading, isProMember, presentPaywall, router]),
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isProMember) {
    return <>{children}</>;
  }

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
      {fallback}
    </View>
  );
}
