import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_HEIGHT = Platform.select({ ios: 88, default: 64 });

const HEADER_POSITION_STYLE = {
  position: 'absolute',
  zIndex: 50,
  top: 0,
  left: 0,
  right: 0,
} as const;

type AiChatHeaderProps = {
  onClear?: () => void;
};

export function AiChatHeader({ onClear }: AiChatHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  return Platform.OS === 'ios' ? (
    <BlurView intensity={100} style={[HEADER_POSITION_STYLE, { paddingTop: insets.top }]}>
      <View className="flex-row items-center justify-between px-4 pb-2">
        <View className="flex-row items-center">
          <Button variant="plain" size="icon" onPress={router.back}>
            <Icon size={30} color={colors.primary} name="chevron-left" />
          </Button>
        </View>
        <View className="items-center">
          <Text variant="title3" className="text-center">
            {t('ai.packratAI')}
          </Text>
          <Text variant="caption2" className="text-muted-foreground">
            {t('ai.hikingAssistant')}
          </Text>
        </View>
        <Button variant="plain" size="icon" onPress={onClear}>
          <Icon
            size={28}
            color={colors.grey2}
            materialIcon={{
              name: 'square-edit-outline',
              type: 'MaterialCommunityIcons',
            }}
            ios={{
              name: 'square.and.pencil',
            }}
          />
        </Button>
      </View>
    </BlurView>
  ) : (
    <View
      className="absolute left-0 right-0 top-0 z-50 justify-end bg-card dark:bg-background"
      style={{ paddingTop: insets.top, height: HEADER_HEIGHT + insets.top }}
    >
      <View
        style={{ height: HEADER_HEIGHT }}
        className="flex-row items-center justify-between gap-2 px-3 pb-2"
      >
        <View className="flex-row items-center">
          <Button variant="plain" size="icon" className="opacity-70" onPress={router.back}>
            <Icon
              color={colors.foreground}
              name={Platform.select({
                ios: 'chevron-left',
                default: 'arrow-left',
              })}
            />
          </Button>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-lg font-medium">{t('ai.packratAI')}</Text>
          <Text variant="caption2" className="text-muted-foreground">
            {t('ai.hikingAssistant')}
          </Text>
        </View>
        <Button variant="plain" size="icon" onPress={onClear}>
          <Icon
            size={28}
            color={colors.grey2}
            materialIcon={{
              name: 'square-edit-outline',
              type: 'MaterialCommunityIcons',
            }}
            ios={{
              name: 'square.and.pencil',
            }}
          />
        </Button>
      </View>
    </View>
  );
}
