import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';

/** What a signed-out visitor sees in place of the feed. */
export function FeedAuthWall() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-8">
      <Stack.Screen options={{ title: t('feed.communityFeed') }} />
      <Icon name="image-multiple-outline" size={56} color={colors.grey} />
      <Text className="text-center text-xl font-medium">{t('feed.authTitle')}</Text>
      <Text className="text-center text-muted-foreground" wrap>
        {t('feed.authBody')}
      </Text>
      <Button
        className="mt-2"
        onPress={() => router.push({ pathname: '/auth', params: { redirectTo: pathname } })}
        testID={testIds.feed.signInButton}
      >
        <Text className="font-medium text-primary-foreground">{t('feed.signIn')}</Text>
      </Button>
    </View>
  );
}
