import { EvilIcons, Ionicons } from '@expo/vector-icons';
import { Card, CardContent, Text } from '@packrat/ui/nativewindui';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Pressable, View } from 'react-native';

interface ErrorStateProps {
  error?: Error;
  onRetry: () => void;
  onClear?: () => void;
}

const CONTEXT_OVERFLOW_PATTERNS = ['Context is full', 'Context limit reached'];

function isContextOverflow(error: Error): boolean {
  return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => error.message.includes(pattern));
}

export function ErrorState({ error, onRetry, onClear }: ErrorStateProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  if (!error) return null;

  if (isContextOverflow(error)) {
    return (
      <Card rootClassName="border border-border rounded-xl bg-inherit shadow-none mx-4">
        <CardContent className="gap-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning-outline" size={20} color={colors.destructive} />
            <Text variant="subhead" className="font-semibold text-foreground">
              {t('errors.contextOverflow.title')}
            </Text>
          </View>
          <Text variant="caption1" className="text-muted-foreground">
            {t('errors.contextOverflow.description')}
          </Text>
          <Text variant="caption1" className="text-muted-foreground">
            {t('errors.contextOverflow.hint')}
          </Text>
          <View className="flex-row gap-3 pt-1">
            {onClear && (
              <Pressable
                onPress={onClear}
                className="flex-1 items-center rounded-lg bg-destructive py-2"
              >
                <Text variant="caption1" className="font-medium text-white">
                  {t('errors.contextOverflow.clearChat')}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onRetry}
              className="flex-1 items-center rounded-lg border border-border py-2"
            >
              <Text variant="caption1" className="font-medium text-foreground">
                {t('errors.tryAgain')}
              </Text>
            </Pressable>
          </View>
        </CardContent>
      </Card>
    );
  }

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
