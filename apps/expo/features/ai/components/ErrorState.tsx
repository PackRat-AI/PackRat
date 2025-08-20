import { EvilIcons } from '@expo/vector-icons';
import { Button, Text } from '@packrat/ui/nativewindui';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { View } from 'react-native';

interface ErrorStateProps {
  error?: Error;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { colors } = useColorScheme();

  if (!error) return null;

  return (
    <View className="mx-4 mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
      <View className="flex-row items-center gap-2">
        <EvilIcons name="exclamation" size={24} color={colors.destructive} />
        <Text className="flex-1 text-sm text-red-700">{error.message}</Text>
        <Button
          variant="tonal"
          size="icon"
          onPress={onRetry}
          className="rounded-lg bg-red-100 px-3 py-1"
        >
          <EvilIcons name="redo" size={20} color={colors.destructive} />
        </Button>
      </View>
    </View>
  );
}
