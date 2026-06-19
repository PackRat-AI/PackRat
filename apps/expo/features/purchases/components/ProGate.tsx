import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
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

  // Only fires for the currently focused screen — background tabs stay silent
  // on app open. v6 useFocusEffect has no internal dep array so it re-runs on
  // every render, which means loading-completion-while-focused is also handled.
  useFocusEffect(
    useCallback(() => {
      if (isLoading || isProMember || isPaywallPresenting) return;

      isPaywallPresenting = true;
      presentPaywall().finally(() => {
        isPaywallPresenting = false;
      });
    }, [isLoading, isProMember, presentPaywall]),
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

  // Render children invisibly so the screen's own <Stack.Screen> mounts and
  // sets the correct header. The upgrade prompt sits on top as a fallback when
  // the paywall sheet is dismissed. Search bar is stripped — it doesn't belong
  // on a paywalled screen.
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
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {fallback ?? <ProUpgradePrompt />}
      </View>
    </View>
  );
}

function ProUpgradePrompt() {
  const { presentPaywall } = usePresentPaywall();

  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <Text className="text-center text-2xl font-bold">PackRat Pro</Text>
      <Text className="text-center text-muted-foreground">
        Unlock this feature and everything Pro has to offer.
      </Text>
      <Button onPress={presentPaywall}>
        <Text>Upgrade to Pro</Text>
      </Button>
    </View>
  );
}
