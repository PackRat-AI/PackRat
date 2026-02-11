import { Button, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView, View } from 'react-native';

export function CatalogItemsAuthWall() {
  const router = useRouter();
  const currentRoute = usePathname();
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <LargeTitleHeader title={t('catalog.title')} backVisible={false} />

      <View className="flex-1 px-6 py-8">
        <View className="mb-8 items-center justify-center">
          <View className="bg-primary/10 mb-4 rounded-full p-6">
            <Icon name="clipboard-outline" size={64} color="text-primary" />
          </View>
          <Text variant="title1" className="text-center">
            {t('catalog.createYourPerfectPack')}
          </Text>
          <Text variant="body" className="mb-6 text-center text-muted-foreground">
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
          className="mb-4 w-full"
        >
          <Text className="font-medium">{t('catalog.signIn')}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
