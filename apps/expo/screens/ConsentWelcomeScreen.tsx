import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Link } from 'expo-router';
import { Platform, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ROOT_STYLE: ViewStyle = { flex: 1 };

export function WelcomeConsentScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const FEATURES = [
    {
      title: t('welcome.features.profileManagement.title'),
      description: t('welcome.features.profileManagement.description'),
      icon: 'account-circle-outline',
    },
    {
      title: t('welcome.features.secureMessaging.title'),
      description: t('welcome.features.secureMessaging.description'),
      icon: 'message-processing',
    },
    {
      title: t('welcome.features.activityTracking.title'),
      description: t('welcome.features.activityTracking.description'),
      icon: 'chart-timeline-variant',
    },
  ] as const;

  return (
    <SafeAreaView style={ROOT_STYLE}>
      <View className="mx-auto max-w-sm flex-1 justify-between gap-4 px-8 py-4 ">
        <View className="ios:pt-8 pt-12">
          <Text variant="largeTitle" className="ios:text-left ios:font-black text-center font-bold">
            {t('common.welcome')}
          </Text>
          <Text
            variant="largeTitle"
            className="ios:text-left ios:font-black text-center font-bold text-primary"
          >
            {t('common.application')}
          </Text>
        </View>
        <View className="gap-8">
          {FEATURES.map((feature) => (
            <View key={feature.title} className="flex-row gap-4">
              <View className="pt-px">
                <Icon
                  name={feature.icon}
                  size={38}
                  color={colors.primary}
                  ios={{ renderingMode: 'hierarchical' }}
                />
              </View>
              <View className="flex-1">
                <Text className="font-bold">{feature.title}</Text>
                <Text variant="footnote">{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>
        <View className="gap-4">
          <View className="items-center">
            <Icon
              name="account-multiple"
              size={24}
              color={colors.primary}
              ios={{ renderingMode: 'hierarchical' }}
            />
            <Text variant="caption2" className="pt-1 text-center">
              {t('welcome.byPressingContinue')}{' '}
              <Link href="/">
                <Text variant="caption2" className="text-primary">
                  {t('welcome.termsOfService')}
                </Text>
              </Link>{' '}
              {t('welcome.and')} {t('welcome.thatYouHaveRead')}{' '}
              <Link href="/">
                <Text variant="caption2" className="text-primary">
                  {t('welcome.privacyPolicy')}
                </Text>
              </Link>
            </Text>
          </View>
          <Link href="../" replace asChild>
            <Button size={Platform.select({ ios: 'lg', default: 'md' })}>
              <Text>{t('common.continue')}</Text>
            </Button>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
