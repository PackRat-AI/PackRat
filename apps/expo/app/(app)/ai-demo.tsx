import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import {
  OnDeviceAIStatus,
  OnDeviceCapabilitiesInfo,
} from 'expo-app/features/ai/components/OnDeviceAIStatus';
import { useOnDeviceAI } from 'expo-app/features/ai/hooks/useOnDeviceAI';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AIDemo() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { capabilities, isOnDeviceAvailable, recommendedProvider } = useOnDeviceAI();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'PackRat AI Demo',
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        <View className="p-4 space-y-6">
          {/* Header */}
          <View className="text-center">
            <Icon name="robot" size={48} color={colors.primary} style={{ alignSelf: 'center' }} />
            <Text variant="largeTitle" className="text-center mt-4 mb-2">
              PackRat AI
            </Text>
            <Text variant="body" className="text-muted-foreground text-center">
              Experience AI-powered outdoor assistance with both cloud and on-device options
            </Text>
          </View>

          {/* On-Device AI Status */}
          <View>
            <Text variant="title2" className="mb-3">
              Device Capabilities
            </Text>
            <OnDeviceAIStatus />

            {capabilities && (
              <View className="mt-3">
                <OnDeviceCapabilitiesInfo capabilities={capabilities} />
              </View>
            )}
          </View>

          {/* Demo Options */}
          <View>
            <Text variant="title2" className="mb-3">
              Try Different AI Modes
            </Text>

            <View className="space-y-3">
              {/* Cloud-based AI */}
              <TouchableCard
                title="Cloud AI Chat"
                description="Traditional cloud-based AI with full feature set"
                icon="cloud"
                color={colors.blue}
                onPress={() => router.push('/ai-chat?contextType=general')}
              />

              {/* On-Device AI */}
              <TouchableCard
                title="On-Device AI Chat"
                description={
                  isOnDeviceAvailable
                    ? `Fast, private AI using ${recommendedProvider}`
                    : 'On-device AI not available on this device'
                }
                icon={recommendedProvider === 'apple' ? 'apple-logo' : 'cpu'}
                color={isOnDeviceAvailable ? colors.success : colors.muted.foreground}
                disabled={!isOnDeviceAvailable}
                onPress={() => router.push('/ai-chat-ondevice?contextType=general')}
              />

              {/* Hybrid Mode (Future) */}
              <TouchableCard
                title="Hybrid AI Mode (Coming Soon)"
                description="Intelligent switching between on-device and cloud AI"
                icon="sync"
                color={colors.muted.foreground}
                disabled={true}
                onPress={() => {}}
              />
            </View>
          </View>

          {/* Feature Comparison */}
          <View>
            <Text variant="title2" className="mb-3">
              Feature Comparison
            </Text>

            <View className="bg-card rounded-lg p-4">
              <ComparisonRow
                feature="Response Speed"
                cloud="Moderate (network dependent)"
                onDevice="Fast (local processing)"
                cloudIcon="wifi"
                onDeviceIcon="flash"
              />
              <ComparisonRow
                feature="Privacy"
                cloud="Data sent to servers"
                onDevice="Fully private, no data sent"
                cloudIcon="cloud-upload"
                onDeviceIcon="shield-checkmark"
              />
              <ComparisonRow
                feature="Offline Usage"
                cloud="Requires internet"
                onDevice="Works offline*"
                cloudIcon="wifi-off"
                onDeviceIcon="checkmark-circle"
              />
              <ComparisonRow
                feature="Model Variety"
                cloud="Multiple advanced models"
                onDevice="Device-optimized models"
                cloudIcon="library"
                onDeviceIcon="hardware-chip"
                isLast
              />
            </View>

            <Text variant="caption2" className="text-muted-foreground mt-2">
              * Some features may require internet for initial setup or specific capabilities
            </Text>
          </View>

          {/* Getting Started */}
          {!isOnDeviceAvailable && (
            <View className="bg-muted/50 rounded-lg p-4">
              <Text variant="subhead" className="font-medium mb-2">
                Enable On-Device AI
              </Text>
              <Text variant="body" className="text-muted-foreground mb-3">
                To use on-device AI features:
              </Text>
              <View className="space-y-2">
                <BulletPoint text="iOS: Ensure you have iOS 18+ with Apple Intelligence enabled" />
                <BulletPoint text="Android: MLC models will be downloaded automatically" />
                <BulletPoint text="Ensure sufficient storage space for model files (1-4GB)" />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

interface TouchableCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  disabled?: boolean;
  onPress: () => void;
}

function TouchableCard({
  title,
  description,
  icon,
  color,
  disabled = false,
  onPress,
}: TouchableCardProps) {
  return (
    <Button
      variant="outline"
      className={`p-4 h-auto ${disabled ? 'opacity-50' : ''}`}
      disabled={disabled}
      onPress={onPress}
    >
      <View className="flex-row items-start gap-3 w-full">
        <Icon name={icon} size={24} color={color} />
        <View className="flex-1">
          <Text variant="callout" className="font-medium mb-1">
            {title}
          </Text>
          <Text variant="caption1" className="text-muted-foreground text-left">
            {description}
          </Text>
        </View>
        {!disabled && <Icon name="chevron-right" size={16} color={color} />}
      </View>
    </Button>
  );
}

interface ComparisonRowProps {
  feature: string;
  cloud: string;
  onDevice: string;
  cloudIcon: string;
  onDeviceIcon: string;
  isLast?: boolean;
}

function ComparisonRow({
  feature,
  cloud,
  onDevice,
  cloudIcon,
  onDeviceIcon,
  isLast = false,
}: ComparisonRowProps) {
  const { colors } = useColorScheme();

  return (
    <View className={`py-3 ${!isLast ? 'border-b border-border' : ''}`}>
      <Text variant="subhead" className="font-medium mb-2">
        {feature}
      </Text>
      <View className="space-y-1">
        <View className="flex-row items-center gap-2">
          <Icon name={cloudIcon} size={14} color={colors.muted.foreground} />
          <Text variant="caption1" className="text-muted-foreground">
            Cloud: {cloud}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Icon name={onDeviceIcon} size={14} color={colors.muted.foreground} />
          <Text variant="caption1" className="text-muted-foreground">
            On-Device: {onDevice}
          </Text>
        </View>
      </View>
    </View>
  );
}

function BulletPoint({ text }: { text: string }) {
  const { colors } = useColorScheme();

  return (
    <View className="flex-row items-start gap-2">
      <Icon name="ellipse" size={6} color={colors.muted.foreground} style={{ marginTop: 6 }} />
      <Text variant="caption1" className="text-muted-foreground flex-1">
        {text}
      </Text>
    </View>
  );
}
