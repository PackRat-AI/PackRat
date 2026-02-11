import { EvilIcons, Ionicons } from '@expo/vector-icons';
import { Card, CardContent, Text } from '@packrat/ui/nativewindui';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Pressable, View } from 'react-native';

interface ErrorStateProps {
  error?: Error;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  if (!error) return null;

  return (
    <Card rootClassName="border border-border rounded-xl bg-inherit shadow-none mx-4">
      <CardContent className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2 pr-2">
          <Ionicons name="alert-circle-outline" size={24} color={colors.destructive} />

          <Text variant="caption2" numberOfLines={2}>
            {t('errors.looksLikeError')}
          </Text>
        </View>
        <Pressable onPress={onRetry}>
          <EvilIcons name="redo" size={24} color={colors.foreground} />
        </Pressable>
      </CardContent>
    </Card>
  );
}
