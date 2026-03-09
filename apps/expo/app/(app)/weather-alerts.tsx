import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

// Mock data for weather alerts covering all alert types required for iOS parity
const WEATHER_ALERTS: {
  id: string;
  type: string;
  location: string;
  dates: string;
  severity: 'Moderate' | 'High' | 'Low';
  details: string;
  icon: MaterialIconName;
  color: string;
}[] = [
  {
    id: '1',
    type: 'Severe Thunderstorms',
    location: 'Appalachian Trail, NC',
    dates: 'May 20, 2024',
    severity: 'High',
    details:
      'Severe thunderstorms with lightning risk. Avoid exposed ridges and summits during afternoon hours.',
    icon: 'weather-lightning-rainy',
    color: '#FFCE56',
  },
  {
    id: '2',
    type: 'Tornado Watch',
    location: 'Ozark Trail, MO',
    dates: 'May 22, 2024',
    severity: 'High',
    details:
      'Tornado watch in effect until 9 PM. Seek shelter in a sturdy building immediately if a tornado warning is issued.',
    icon: 'weather-tornado',
    color: '#FF6384',
  },
  {
    id: '3',
    type: 'Flash Flood Alert',
    location: 'Appalachian Trail, GA',
    dates: 'May 15-17, 2024',
    severity: 'High',
    details:
      'Flash flood watch in effect. Expect 2-4 inches of rain. Avoid creek crossings and low-lying trail sections.',
    icon: 'waves',
    color: '#36A2EB',
  },
  {
    id: '4',
    type: 'Red Flag Fire Warning',
    location: 'Pacific Crest Trail, CA',
    dates: 'June 10-12, 2024',
    severity: 'High',
    details:
      'Extreme fire danger due to low humidity, high temperatures, and gusty winds. No campfires permitted.',
    icon: 'fire',
    color: '#FF5722',
  },
  {
    id: '5',
    type: 'Winter Storm Advisory',
    location: 'John Muir Trail, CA',
    dates: 'July 4-5, 2024',
    severity: 'Moderate',
    details:
      'Unexpected late-season snow at elevations above 10,000 ft. Expect 4-6 inches. Prepare for icy conditions.',
    icon: 'weather-snowy-heavy',
    color: '#90CAF9',
  },
  {
    id: '6',
    type: 'Heat Advisory',
    location: 'Appalachian Trail, VA',
    dates: 'June 1-3, 2024',
    severity: 'High',
    details:
      'Temperatures expected to reach 90-95°F with high humidity. Carry extra water and plan for shade breaks.',
    icon: 'thermometer-alert',
    color: '#EF5350',
  },
  {
    id: '7',
    type: 'High Wind Warning',
    location: 'Appalachian Trail, NH',
    dates: 'June 5-6, 2024',
    severity: 'Moderate',
    details:
      'Sustained winds of 20-30 mph with gusts up to 45 mph. Secure loose items and be cautious of falling branches.',
    icon: 'weather-windy',
    color: '#4BC0C0',
  },
  {
    id: '8',
    type: 'Dense Fog Advisory',
    location: 'Olympic Peninsula, WA',
    dates: 'May 25, 2024',
    severity: 'Low',
    details:
      'Dense fog reducing visibility to near zero along coastal trails. Use caution and carry navigation equipment.',
    icon: 'weather-fog',
    color: '#B0BEC5',
  },
];

function AlertSeverity({ severity }: { severity: string }) {
  const { t } = useTranslation();
  const getColor = () => {
    switch (severity) {
      case 'High':
        return 'bg-red-500';
      case 'Moderate':
        return 'bg-amber-500';
      case 'Low':
        return 'bg-green-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Translate the severity text
  const getSeverityText = () => {
    switch (severity) {
      case 'High':
        return t('common.high');
      case 'Moderate':
        return t('weather.moderate');
      case 'Low':
        return t('weather.low');
      default:
        return severity;
    }
  };

  return (
    <View className={cn('rounded-full px-2 py-1', getColor())}>
      <Text variant="caption2" className="font-medium text-white">
        {getSeverityText()}
      </Text>
    </View>
  );
}

function WeatherAlertCard({ alert }: { alert: (typeof WEATHER_ALERTS)[0] }) {
  const { colors } = useColorScheme();
  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="border-b border-border p-4">
        <View className="flex-row items-center">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: alert.color }}
          >
            <Icon name={alert.icon} size={24} color="white" />
          </View>

          <View className="ml-3 flex-1">
            <View className="flex-row items-center justify-between">
              <Text variant="heading" className="font-semibold">
                {alert.type}
              </Text>
              <AlertSeverity severity={alert.severity} />
            </View>
            <Text variant="subhead" className="text-muted-foreground">
              {alert.location} • {alert.dates}
            </Text>
          </View>
        </View>
      </View>

      <View className="p-4">
        <View className="flex-row items-start">
          <View className="mr-2 mt-1 text-muted-foreground">
            <Icon name="information-outline" size={16} color={colors.grey} />
          </View>
          <Text variant="body" className="flex-1">
            {alert.details}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function WeatherAlertsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <>
      <LargeTitleHeader title={t('weather.weatherAlertsTitle')} />
      <ScrollView className="flex-1">
        <View className="flex-row items-center justify-between p-4">
          <Text variant="subhead" className="text-muted-foreground">
            {t('weather.currentWeatherAlerts')}
          </Text>
          <Pressable
            onPress={() => router.push('/weather-alert-preferences')}
            className="flex-row items-center gap-1"
          >
            <Icon name="tune-vertical-variant" size={16} color="#3B82F6" />
            <Text variant="footnote" className="text-primary">
              {t('weather.manageAlerts')}
            </Text>
          </Pressable>
        </View>

        <View className="pb-4">
          {WEATHER_ALERTS.map((alert) => (
            <WeatherAlertCard key={alert.id} alert={alert} />
          ))}
        </View>

        <View className="mx-4 my-2 rounded-lg bg-card p-4">
          <Text variant="footnote" className="text-muted-foreground">
            {t('weather.weatherDataLastUpdated', { date: 'Today, 9:45 AM' })}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
