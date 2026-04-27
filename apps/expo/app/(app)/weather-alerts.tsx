import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { useWeatherAlerts } from 'expo-app/features/weather/hooks/useWeatherAlert';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type WeatherAlert = {
  id: string;
  type: string;
  location: string;
  dates: string;
  severity: 'Low' | 'Moderate' | 'High';
  details: string;
};

function getAlertMeta(type: string): {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
} {
  const t = type.toLowerCase();

  if (t.includes('storm') || t.includes('thunder'))
    return { icon: 'weather-lightning', color: '#FFCE56' };

  if (t.includes('tornado')) return { icon: 'weather-tornado', color: '#FF6384' };

  if (t.includes('flood')) return { icon: 'waves', color: '#36A2EB' };

  if (t.includes('fire')) return { icon: 'fire', color: '#FF5722' };

  if (t.includes('snow') || t.includes('winter'))
    return { icon: 'weather-snowy', color: '#90CAF9' };

  if (t.includes('heat')) return { icon: 'thermometer-high', color: '#EF5350' };

  if (t.includes('wind')) return { icon: 'weather-windy', color: '#4BC0C0' };

  if (t.includes('fog') || t.includes('mist') || t.includes('visibility'))
    return { icon: 'weather-fog', color: '#B0BEC5' };

  if (t.includes('rain')) return { icon: 'weather-rainy', color: '#36A2EB' };

  return { icon: 'alert-circle', color: '#999' };
}

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

function WeatherAlertCard({ alert }: { alert: WeatherAlert }) {
  const { colors } = useColorScheme();
  const meta = getAlertMeta(alert.type);
  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="border-b border-border p-4">
        <View className="flex-row items-center">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: meta.color }}
          >
            <MaterialCommunityIcons name={meta.icon} size={24} color="white" />
          </View>

          <View className="ml-3 flex-1">
            <View className="flex-row items-center justify-between">
              <Text variant="heading" className="font-semibold flex-1 mr-2" numberOfLines={2}>
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
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.grey} />
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
  const { alerts, loading, error, activeLocation } = useWeatherAlerts();

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LargeTitleHeader title={t('weather.weatherAlertsTitle')} />
      <ScrollView className="flex-1 mt-20" contentInsetAdjustmentBehavior="automatic">
        <View className="flex-row items-center justify-between p-4">
          <Text
            variant="subhead"
            className="flex-1 text-muted-foreground"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {t('weather.currentWeatherAlerts')}
          </Text>

          <Pressable
            onPress={() => router.push('/weather-alert-preferences')}
            className="flex-row items-center gap-1 ml-2"
          >
            <MaterialCommunityIcons name="tune-vertical-variant" size={16} color="#3B82F6" />
            <Text variant="footnote" className="text-primary">
              {t('weather.manageAlerts')}
            </Text>
          </Pressable>
        </View>

        <View className="pb-4">
          {loading && <Text className="mx-4">Loading alerts...</Text>}

          {error && <Text className="mx-4 text-red-500">{error}</Text>}

          {!loading && alerts.length === 0 && (
            <Text className="mx-4 text-muted-foreground">
              No active alerts for {activeLocation?.name ?? 'this location'}
            </Text>
          )}

          {alerts.map((alert) => (
            <WeatherAlertCard key={alert.id} alert={alert} />
          ))}
        </View>

        <View className="mx-4 my-2 rounded-lg bg-card p-4">
          <Text variant="footnote" className="text-muted-foreground">
            {t('weather.weatherDataLastUpdated', {
              date: new Date().toLocaleTimeString(),
            })}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
