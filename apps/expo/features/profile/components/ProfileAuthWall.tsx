import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon, type MaterialIconName } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Link, Stack, usePathname, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ProfileAuthWall() {
  const router = useRouter();
  const currentRoute = usePathname();
  const { t } = useTranslation();
  const { colors } = useColorScheme();

  const SCREEN_OPTIONS = {
    title: t('profile.profile'),
    headerShown: false,
  } as const;

  return (
    <SafeAreaView className="flex-1">
      <Stack.Screen options={SCREEN_OPTIONS} />

      <View className="items-end px-4 pt-2">
        <Link href="/settings" asChild>
          <Pressable hitSlop={8}>
            <Icon name="cog-outline" size={24} color={colors.foreground} />
          </Pressable>
        </Link>
      </View>

      {/* Scrollable: the four feature rows plus the sign-in button exceed a 720x1600 screen once the
          tab bar and the "sync paused" banner are accounted for, which left the Sign In button
          clipped below the fold and unreachable — a guest could not sign in from this screen at all.
          `flex-grow` on the content container keeps the layout identical on taller screens. */}
      <ScrollView
        contentContainerClassName="flex-grow px-6 py-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 items-center">
          <View className="bg-primary/10 mb-4 h-24 w-24 items-center justify-center rounded-full">
            <Icon name="account-circle-outline" size={48} color="primary" />
          </View>
          <Text variant="title1" className="mb-2 text-center">
            {t('profile.createYourAccount')}
          </Text>
          <Text className="mb-6 text-center text-muted-foreground" wrap>
            {t('profile.joinPackRat')}
          </Text>
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
          // `mt-auto` keeps the button pinned to the bottom on tall screens (the old flex-1 layout's
          // behaviour) while `flex-grow` on the content container lets it be pushed into scrollable
          // overflow on short ones instead of being clipped.
          className="mb-4 mt-auto w-full"
        >
          <Text className="font-medium">{t('auth.signIn')}</Text>
        </Button>
      </ScrollView>
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
        <Text className="text-muted-foreground" wrap>
          {description}
        </Text>
      </View>
    </View>
  );
}
