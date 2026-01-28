import { Button, cn, Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { View } from 'react-native';

interface ErrorStateProps {
  title?: string;
  text?: string;
  retryText?: string;
  onRetry: () => void;
  className?: string;
}

export const ErrorState = ({
  title = 'Something went wrong',
  text,
  retryText = 'Retry',
  className,
  onRetry,
}: ErrorStateProps) => {
  const { colors, isDarkColorScheme } = useColorScheme();

  return (
    <View className={cn('flex-1 items-center justify-center', className)}>
      <View className="bg-destructive/10 dark:bg-destructive/90 mb-4 rounded-full p-4">
        <Icon
          name="exclamation"
          size={32}
          color={isDarkColorScheme ? '#ef4444' : colors.destructive}
        />
      </View>
      <Text className="mb-2 text-center text-lg font-medium text-foreground">{title}</Text>
      {text && <Text className="mb-6 text-center text-sm text-muted-foreground">{text}</Text>}
      {onRetry && (
        <Button onPress={onRetry} variant="secondary">
          <Text>{retryText}</Text>
        </Button>
      )}
    </View>
  );
};
