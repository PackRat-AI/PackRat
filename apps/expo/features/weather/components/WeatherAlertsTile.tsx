import type { AlertRef } from '@packrat/ui/nativewindui';
import { Alert, ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Platform, View } from 'react-native';

export function WeatherAlertsTile() {
  const router = useRouter();
  const alertRef = useRef<AlertRef>(null);
  const { t } = useTranslation();

  const handlePress = () => {
    // if (!currentPack) {
    //   alertRef.current?.show();
    //   return;
    // }
    router.push('/weather-alerts');
  };

  const weatherAlertCount = 10;

  return (
    <>
      <ListItem
        className="ios:pl-0 pl-2"
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-amber-500">
              <Icon name="weather-rainy" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <Text className="mr-2">{t('weather.activeCount', { count: weatherAlertCount })}</Text>
            <ChevronRight />
          </View>
        }
        item={{
          title: t('weather.weatherAlerts'),
        }}
        onPress={handlePress}
        target="Cell"
        index={0}
        removeSeparator={Platform.OS === 'ios'}
      />
      <Alert
        title={t('weather.noTripsYet')}
        message={t('weather.createTripForAlerts')}
        materialIcon={{ name: 'information-outline' }}
        materialWidth={370}
        buttons={[
          {
            text: t('weather.gotIt'),
            style: 'default',
          },
        ]}
        ref={alertRef}
      />
    </>
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
