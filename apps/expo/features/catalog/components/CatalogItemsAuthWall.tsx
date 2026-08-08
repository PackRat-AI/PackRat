import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack, usePathname, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function CatalogItemsAuthWall() {
  const router = useRouter();
  const currentRoute = usePathname();
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Scrollable for the same reason as ProfileAuthWall: on a short screen the feature rows plus
          the sign-in button exceed the viewport once the tab bar is accounted for, which left the
          button clipped and unreachable. `flex-grow` keeps taller screens looking identical. */}
      <ScrollView
        contentContainerClassName="flex-grow px-6 py-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 items-center justify-center">
          <View className="bg-primary/10 mb-4 rounded-full p-6">
            <Icon name="clipboard-outline" size={64} color="text-primary" />
          </View>
          <Text variant="title1" className="text-center">
            {t('catalog.createYourPerfectPack')}
          </Text>
          <Text variant="body" className="mb-6 text-center text-muted-foreground" wrap>
            {t('catalog.signInMessage')}
          </Text>
        </View>

        <Button
          onPress={() =>
            router.push({
              pathname: '/auth',
              params: { redirectTo: currentRoute },
            })
          }
          size="lg"
          variant="primary"
          className="mb-4 mt-auto w-full"
        >
          <Text className="font-medium">{t('catalog.signIn')}</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
