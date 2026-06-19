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

  // Render children invisibly so Stack.Screen mounts and sets the correct header.
  // No visible fallback — the paywall sheet is the only UI shown to non-pro users.
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
