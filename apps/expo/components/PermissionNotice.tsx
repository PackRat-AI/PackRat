import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import {
  openPermissionSettings,
  type PermissionSettingsTarget,
} from 'expo-app/lib/utils/openPermissionSettings';
import { View } from 'react-native';

/**
 * A line saying a phone permission is off, with the way to Settings to turn it back on. Sits in
 * place of whatever the permission would have made happen.
 */
export function PermissionNotice({
  message,
  testID,
  tone = 'muted',
  variant = 'footnote',
  className,
  settings = 'app',
}: {
  message: string;
  /** Which settings page Open Settings lands on. */
  settings?: PermissionSettingsTarget;
  /** For the Open Settings button. */
  testID: string;
  tone?: 'muted' | 'destructive';
  variant?: 'footnote' | 'callout';
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className={className}>
      <Text
        variant={variant}
        className={tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}
        wrap
      >
        {message}
      </Text>
      <Button
        variant="text"
        className="self-start px-0"
        onPress={() => void openPermissionSettings(settings)}
        testID={testID}
      >
        <Text className="font-medium text-primary">{t('permissions.openSettings')}</Text>
      </Button>
    </View>
  );
}
