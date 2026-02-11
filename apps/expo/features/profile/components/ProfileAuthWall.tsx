import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack, usePathname, useRouter } from 'expo-router';
import { SafeAreaView, View } from 'react-native';

export function ProfileAuthWall() {
  const router = useRouter();
  const currentRoute = usePathname();
  const { t } = useTranslation();

  const SCREEN_OPTIONS = {
    title: t('profile.profile'),
    headerShown: false,
  } as const;

  return (
    <SafeAreaView className="flex-1">
      <Stack.Screen options={SCREEN_OPTIONS} />

      <View className="flex-1 px-6 py-8">
        <View className="mb-8 items-center">
          <View className="bg-primary/10 mb-4 h-24 w-24 items-center justify-center rounded-full">
            <Icon name="account-circle-outline" size={48} color="primary" />
          </View>
          <Text variant="title1" className="mb-2 text-center">
            {t('profile.createYourAccount')}
          </Text>
          <Text className="mb-6 text-center text-muted-foreground">{t('profile.joinPackRat')}</Text>
        </View>

        <View className="mb-10 flex-col gap-6">
          <FeatureItem
            icon="cloud-outline"
            title={t('profile.syncDevicesTitle')}
            description={t('profile.syncDevicesDesc')}
          />
          <FeatureItem
            icon="weather-sunny"
            title={t('profile.weatherIntegrationTitle')}
            description={t('profile.weatherIntegrationDesc')}
          />
          <FeatureItem
            icon="message-outline"
            title={t('profile.aiChatTitle')}
            description={t('profile.aiChatDesc')}
          />
          <FeatureItem
            icon="archive-outline"
            title={t('profile.sharePacksTitle')}
            description={t('profile.sharePacksDesc')}
          />
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
          <Text className="font-medium">{t('auth.signIn')}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: MaterialIconName;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-center">
      <View className="bg-primary/10 mr-4 h-10 w-10 items-center justify-center rounded-full">
        <Icon name={icon} size={20} color="primary" />
      </View>
      <View className="flex-1">
        <Text variant="title3" className="mb-0.5">
          {title}
        </Text>
        <Text className="text-muted-foreground">{description}</Text>
      </View>
    </View>
  );
}
