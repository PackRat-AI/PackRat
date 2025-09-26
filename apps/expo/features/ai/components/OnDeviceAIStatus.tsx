import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { ActivityIndicator, View } from 'react-native';
import { useOnDeviceAI } from '../hooks/useOnDeviceAI';
import type { OnDeviceProvider } from '../providers/on-device-ai';

interface OnDeviceAIStatusProps {
  onConfigurePress?: () => void;
}

function getProviderIcon(provider: OnDeviceProvider): string {
  switch (provider) {
    case 'apple':
      return 'apple-logo';
    case 'mlc':
      return 'cpu';
    default:
      return 'chip';
  }
}

function getProviderLabel(provider: OnDeviceProvider): string {
  switch (provider) {
    case 'apple':
      return 'Apple Intelligence';
    case 'mlc':
      return 'MLC Engine';
    default:
      return 'Unknown Provider';
  }
}

export function OnDeviceAIStatus({ onConfigurePress }: OnDeviceAIStatusProps) {
  const { colors } = useColorScheme();
  const { capabilities, isLoading, error, isOnDeviceAvailable, recommendedProvider, refresh } =
    useOnDeviceAI();

  if (isLoading) {
    return (
      <View className="flex-row items-center gap-2 p-3 bg-card rounded-lg">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text variant="caption1" className="text-muted-foreground">
          Detecting AI capabilities...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-row items-center gap-2 p-3 bg-destructive/10 rounded-lg">
        <Icon name="alert-circle" size={16} color={colors.destructive} />
        <Text variant="caption1" className="text-destructive flex-1">
          Error: {error}
        </Text>
        <Button variant="ghost" size="sm" onPress={refresh}>
          <Text variant="caption1">Retry</Text>
        </Button>
      </View>
    );
  }

  if (!isOnDeviceAvailable) {
    return (
      <View className="flex-row items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <Icon name="cloud" size={16} color={colors.muted.foreground} />
        <View className="flex-1">
          <Text variant="caption1" className="text-muted-foreground">
            On-device AI not available
          </Text>
          <Text variant="caption2" className="text-muted-foreground">
            Using cloud-based AI
          </Text>
        </View>
        {onConfigurePress && (
          <Button variant="ghost" size="sm" onPress={onConfigurePress}>
            <Text variant="caption1">Setup</Text>
          </Button>
        )}
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-2 p-3 bg-success/10 rounded-lg">
      <Icon name={getProviderIcon(recommendedProvider!)} size={16} color={colors.success} />
      <View className="flex-1">
        <Text variant="caption1" className="text-success">
          {getProviderLabel(recommendedProvider!)} Ready
        </Text>
        <Text variant="caption2" className="text-muted-foreground">
          Faster, private responses
        </Text>
      </View>
      {onConfigurePress && (
        <Button variant="ghost" size="sm" onPress={onConfigurePress}>
          <Icon name="settings" size={16} color={colors.muted.foreground} />
        </Button>
      )}
    </View>
  );
}

interface OnDeviceCapabilitiesInfoProps {
  capabilities: ReturnType<typeof useOnDeviceAI>['capabilities'];
}

export function OnDeviceCapabilitiesInfo({ capabilities }: OnDeviceCapabilitiesInfoProps) {
  if (!capabilities) {
    return null;
  }

  return (
    <View className="space-y-2 p-3 bg-card rounded-lg">
      <Text variant="subhead" className="font-medium">
        Device AI Capabilities
      </Text>

      <View className="space-y-1">
        <CapabilityRow
          label="Apple Intelligence"
          available={capabilities.supportsAppleIntelligence}
        />
        <CapabilityRow label="MLC Engine" available={capabilities.supportsMLC} />
      </View>

      {capabilities.recommendedProvider && (
        <View className="pt-2 border-t border-border">
          <Text variant="caption1" className="text-muted-foreground">
            Recommended: {getProviderLabel(capabilities.recommendedProvider)}
          </Text>
        </View>
      )}
    </View>
  );
}

function CapabilityRow({ label, available }: { label: string; available: boolean }) {
  const { colors } = useColorScheme();

  return (
    <View className="flex-row items-center gap-2">
      <Icon
        name={available ? 'checkmark-circle' : 'close-circle'}
        size={16}
        color={available ? colors.success : colors.muted.foreground}
      />
      <Text variant="caption1" className={available ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </Text>
    </View>
  );
}
