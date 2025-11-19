'use client';

import { Button } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

type ErrorScreenProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
  variant?: 'default' | 'subtle' | 'destructive';
  icon?: MaterialIconName;
};

export function ErrorScreen({
  title,
  message,
  onRetry,
  showHomeButton = true,
  variant = 'default',
  icon = 'exclamation',
}: ErrorScreenProps) {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const handleGoHome = () => {
    router.replace('/');
  };

  const getIconColor = () => {
    switch (variant) {
      case 'subtle':
        return colors.grey3;
      case 'destructive':
        return colors.destructive;
      default:
        return colors.primary;
    }
  };

  return (
    <View className="flex-1 bg-background px-6 pt-12">
      <View className="flex-1 items-center justify-center gap-4">
        {/* Icon */}
        <Icon name={icon} size={48} color={getIconColor()} />

        {/* Content */}
        <View className="mt-6 w-full max-w-sm">
          <Text className="text-center text-xl font-bold text-foreground">
            {title ?? t('errors.somethingWentWrong')}
          </Text>
          <Text className="mt-2 text-center text-base text-muted-foreground">
            {message ?? t('errors.unexpectedError')}
          </Text>
        </View>

        {/* Actions */}
        <View className="mt-4 w-full max-w-sm gap-2">
          {onRetry && (
            <Button onPress={onRetry} variant="primary" className="h-12 w-full">
              <Text className="font-medium text-primary-foreground">
                {t('errors.tryAgainButton')}
              </Text>
            </Button>
          )}

          {showHomeButton && (
            <Button onPress={handleGoHome} variant="secondary" className="h-12 w-full">
              <Text className="font-medium text-foreground">{t('errors.goHome')}</Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}
