import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { View } from 'react-native';

/**
 * Says trip alerts can't arrive while notifications are off for PackRat, with
 * the way to turn them back on. Product behaviour: docs/features/weather-alerts.md.
 */
export function NotificationsOffNotice({
  onOpenSettings,
  className = '',
  testID,
}: {
  onOpenSettings: () => void;
  className?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  return (
    <View
      className={`flex-row items-start gap-3 rounded-xl border border-border bg-card p-4 ${className}`}
      testID={testID}
    >
      <Icon name="bell-off-outline" size={24} color={colors.grey} />
      <View className="flex-1 items-start gap-3">
        <Text wrap>{t('weather.notificationsOffNotice')}</Text>
        <Button variant="tonal" size="sm" onPress={onOpenSettings} testID={`${testID}-settings`}>
          <Text>{t('weather.openSettings')}</Text>
        </Button>
      </View>
    </View>
  );
}
