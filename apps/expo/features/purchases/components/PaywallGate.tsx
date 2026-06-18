import { ActivityIndicator } from '@packrat/ui/nativewindui';
import { View } from 'react-native';
import { useEntitlement } from '../hooks/useEntitlement';
import { UpgradePrompt } from './UpgradePrompt';

interface PaywallGateProps {
  children: React.ReactNode;
}

export function PaywallGate({ children }: PaywallGateProps) {
  const { isPro, isLoading } = useEntitlement();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!isPro) {
    return <UpgradePrompt />;
  }

  return <>{children}</>;
}
