import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Material 3 full-screen dialog header: a close icon, the title, and a text action on the right
 * that turns into a spinner while the action runs.
 */
export function FeedDialogHeader({
  title,
  actionLabel,
  onClose,
  onAction,
  canAct,
  isBusy,
  closeTestID,
  actionTestID,
}: {
  title: string;
  actionLabel: string;
  onClose: () => void;
  onAction: () => void;
  canAct: boolean;
  isBusy: boolean;
  closeTestID: string;
  actionTestID: string;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <View className="h-16 flex-row items-center gap-1 px-1">
        <Pressable
          onPress={onClose}
          disabled={isBusy}
          className="p-3"
          accessibilityRole="button"
          accessibilityLabel={t('feed.close')}
          android_ripple={{ borderless: true, color: colors.grey5 }}
          testID={closeTestID}
        >
          <Icon name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text variant="title3" className="flex-1" numberOfLines={1}>
          {title}
        </Text>
        {isBusy ? (
          <View className="px-5">
            <ActivityIndicator size="small" />
          </View>
        ) : (
          <Pressable
            onPress={onAction}
            disabled={!canAct}
            className="h-10 justify-center rounded-full px-3"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAct }}
            android_ripple={{ color: colors.grey5 }}
            testID={actionTestID}
          >
            <Text
              variant="callout"
              className="font-medium"
              style={{ color: canAct ? colors.primary : colors.grey }}
            >
              {actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
