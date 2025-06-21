'use client';

import { Icon, MaterialIconName } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from 'nativewindui/Button';
import { useColorScheme } from '~/lib/useColorScheme';

type ErrorScreenProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
  variant?: 'default' | 'subtle' | 'destructive';
  icon?: MaterialIconName;
};

export function ErrorScreen({
  title = 'Something went wrong',
  message = "We're having trouble loading this page. Please try again.",
  onRetry,
  showHomeButton = true,
  variant = 'default',
  icon = 'exclamation',
}: ErrorScreenProps) {
  const router = useRouter();
  const { colors } = useColorScheme();

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
          <Text className="text-center text-xl font-bold text-foreground">{title}</Text>
          <Text className="mt-2 text-center text-base text-muted-foreground">{message}</Text>
        </View>

        {/* Actions */}
        <View className="mt-4 w-full max-w-sm gap-2">
          {onRetry && (
            <Button onPress={onRetry} variant="primary" className="h-12 w-full">
              <Text className="font-medium text-primary-foreground">Try Again</Text>
            </Button>
          )}

          {showHomeButton && (
            <Button onPress={handleGoHome} variant="secondary" className="h-12 w-full">
              <Text className="font-medium text-foreground">Go Home</Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}
