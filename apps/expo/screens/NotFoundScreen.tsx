'use client';
import { Button } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

type NotFoundScreenProps = {
  title?: string;
  message?: string;
  backButtonLabel?: string;
  onBackPress?: () => void;
};

export const NotFoundScreen = ({
  title = 'Not Found',
  message = "The content you're looking for doesn't exist or has been moved.",
  backButtonLabel = 'Go Back',
  onBackPress,
}: NotFoundScreenProps) => {
  const router = useRouter();
  const { colors } = useColorScheme();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="items-center gap-4">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full">
          <Icon name="exclamation" size={40} color={colors.foreground} />
        </View>

        <Text className="mb-2 text-center text-2xl font-bold">{title}</Text>

        <Text className="mb-8 max-w-xs text-center">{message}</Text>

        <Button
          onPress={handleBackPress}
          variant="primary"
          className="h-12 flex-row items-center gap-2"
        >
          <Icon name="chevron-left" size={18} color={colors.foreground} />
          <Text className="font-medium">{backButtonLabel}</Text>
        </Button>
      </View>
    </View>
  );
};
