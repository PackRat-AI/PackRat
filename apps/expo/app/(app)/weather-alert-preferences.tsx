import {
  Form,
  FormItem,
  FormSection,
  LargeTitleHeader,
  Text,
  Toggle,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AlertPreferences = {
  weatherNotifications: boolean;
  locationMonitoring: boolean;
  severeStorms: boolean;
  tornadoWarnings: boolean;
  floodAlerts: boolean;
  fireDanger: boolean;
  winterWeather: boolean;
  extremeTemperature: boolean;
  highWinds: boolean;
  fogAlerts: boolean;
};

type AlertTypeConfig = {
  key: keyof Omit<AlertPreferences, 'weatherNotifications' | 'locationMonitoring'>;
  iconName: string;
  iconColor: string;
};

const ALERT_TYPE_CONFIGS: AlertTypeConfig[] = [
  { key: 'severeStorms', iconName: 'weather-lightning-rainy', iconColor: '#FFCE56' },
  { key: 'tornadoWarnings', iconName: 'weather-tornado', iconColor: '#FF6384' },
  { key: 'floodAlerts', iconName: 'waves', iconColor: '#36A2EB' },
  { key: 'fireDanger', iconName: 'fire', iconColor: '#FF5722' },
  { key: 'winterWeather', iconName: 'weather-snowy-heavy', iconColor: '#90CAF9' },
  { key: 'extremeTemperature', iconName: 'thermometer-alert', iconColor: '#EF5350' },
  { key: 'highWinds', iconName: 'weather-windy', iconColor: '#4BC0C0' },
  { key: 'fogAlerts', iconName: 'weather-fog', iconColor: '#B0BEC5' },
];

export default function WeatherAlertPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const [preferences, setPreferences] = React.useState<AlertPreferences>({
    weatherNotifications: true,
    locationMonitoring: true,
    severeStorms: true,
    tornadoWarnings: true,
    floodAlerts: true,
    fireDanger: true,
    winterWeather: true,
    extremeTemperature: true,
    highWinds: false,
    fogAlerts: false,
  });

  function onToggle(key: keyof AlertPreferences) {
    return (value: boolean) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    };
  }

  const alertTypesDisabled = !preferences.weatherNotifications;

  return (
    <>
      <LargeTitleHeader title={t('weather.alertPreferencesTitle')} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        <Form className="gap-5 px-4 pt-4">
          <FormSection
            materialIconProps={{ name: 'bell-outline' }}
            footnote={t('weather.alertPreferencesDesc')}
          >
            <FormItem className="ios:px-4 ios:pb-2 ios:pt-2 flex-row items-center justify-between px-2 pb-4">
              <View className="flex-1 flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
                  <Icon name="bell-outline" size={18} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium">{t('weather.weatherNotifications')}</Text>
                  <Text variant="caption1" className="text-muted-foreground">
                    {t('weather.weatherNotificationsDesc')}
                  </Text>
                </View>
              </View>
              <Toggle
                value={preferences.weatherNotifications}
                onValueChange={onToggle('weatherNotifications')}
              />
            </FormItem>
            <FormItem className="ios:px-4 ios:pb-2 ios:pt-2 flex-row items-center justify-between px-2 pb-4">
              <View className="flex-1 flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
                  <Icon name="map-marker-radius-outline" size={18} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium">{t('weather.locationMonitoring')}</Text>
                  <Text variant="caption1" className="text-muted-foreground">
                    {t('weather.locationMonitoringDesc')}
                  </Text>
                </View>
              </View>
              <Toggle
                value={preferences.locationMonitoring}
                onValueChange={onToggle('locationMonitoring')}
              />
            </FormItem>
          </FormSection>

          <FormSection
            ios={{ title: t('weather.alertTypes') }}
            materialIconProps={{ name: 'alert-outline' }}
            footnote={alertTypesDisabled ? t('weather.weatherNotificationsDesc') : undefined}
          >
            {ALERT_TYPE_CONFIGS.map(({ key, iconName, iconColor }) => (
              <View
                key={key}
                style={{ opacity: alertTypesDisabled ? 0.5 : 1 }}
                pointerEvents={alertTypesDisabled ? 'none' : 'auto'}
              >
                <FormItem className="ios:px-4 ios:pb-2 ios:pt-2 flex-row items-center justify-between px-2 pb-4">
                  <View className="flex-1 flex-row items-center gap-3">
                    <View
                      className="h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: alertTypesDisabled ? colors.grey3 : iconColor,
                      }}
                    >
                      <Icon name={iconName as never} size={18} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={
                          alertTypesDisabled ? 'font-medium text-muted-foreground' : 'font-medium'
                        }
                      >
                        {t(`weather.${key}` as never)}
                      </Text>
                      <Text variant="caption1" className="text-muted-foreground">
                        {t(`weather.${key}Desc` as never)}
                      </Text>
                    </View>
                  </View>
                  <Toggle value={preferences[key]} onValueChange={onToggle(key)} />
                </FormItem>
              </View>
            ))}
          </FormSection>
        </Form>
      </ScrollView>
    </>
  );
}
