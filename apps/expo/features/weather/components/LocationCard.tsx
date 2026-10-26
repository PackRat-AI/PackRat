import { BadgeDot } from '@packrat/ui/src/badge-dot';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { getWeatherBackgroundColors } from '../lib/weatherService';
import type { WeatherLocation } from '../types';
import { alertTitle } from '../utils/alertState';

const NEW_ALERT_COLOR = '#FFB4AB'; // M3 dark-scheme error, legible on every sky gradient

interface LocationCardProps {
  location: WeatherLocation;
  isWatched: boolean;
  hasNewAlert: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * A saved location as a filled card on its own sky colour. The lead alert, if
 * any, replaces the condition line; a new one is marked with an M3 badge dot.
 */
export function LocationCard({
  location,
  isWatched,
  hasNewAlert,
  onPress,
  onLongPress,
}: LocationCardProps) {
  const { t } = useTranslation();
  const { displayTemperature } = useTemperatureUnit();
  const lead = location.alertList?.[0];
  const statusLine = lead ? alertTitle(lead) : location.condition;
  const gradient = getWeatherBackgroundColors({
    code: location.details?.weatherCode ?? 1000,
    isNight: location.details?.isDay === 0,
  });

  const a11yLabel = [
    location.name,
    displayTemperature(location.temperature),
    statusLine,
    hasNewAlert ? t('weather.newAlert') : null,
    isWatched ? t('weather.watchedForAlerts') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      className="overflow-hidden rounded-3xl"
      android_ripple={{ color: 'rgba(255,255,255,0.16)', foreground: true }}
      testID={testIds.weather.location(location.id)}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View className="min-h-[116px] justify-between gap-3 p-4">
          <View className="flex-row justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xl font-medium text-white" numberOfLines={1}>
                  {location.name}
                </Text>
                {isWatched ? (
                  <Icon
                    name="bell"
                    size={14}
                    color={hasNewAlert ? NEW_ALERT_COLOR : 'rgba(255,255,255,0.85)'}
                  />
                ) : null}
              </View>
              <Text variant="subhead" className="text-white/80">
                {location.time}
              </Text>
            </View>
            <View className="items-end">
              <Text
                className="text-white"
                style={{ fontSize: 44, fontWeight: '300', lineHeight: 50 }}
              >
                {displayTemperature(location.temperature)}
              </Text>
              <Text variant="subhead" className="text-white/90">
                H:{displayTemperature(location.highTemp)} L:{displayTemperature(location.lowTemp)}
              </Text>
            </View>
          </View>
          {/* Full width so an alert headline reads in full; a long one wraps once. */}
          <View className="flex-row items-start gap-1.5">
            {lead ? (
              <View className="pt-0.5">
                <Icon name="alert" size={16} color={hasNewAlert ? NEW_ALERT_COLOR : 'white'} />
              </View>
            ) : null}
            <Text
              variant="subhead"
              numberOfLines={2}
              className="flex-1 font-medium"
              style={{ color: lead && hasNewAlert ? NEW_ALERT_COLOR : 'white' }}
            >
              {statusLine}
            </Text>
          </View>
        </View>
      </LinearGradient>
      {hasNewAlert ? (
        <BadgeDot
          testID={testIds.weather.newAlertDot(location.id)}
          style={{ position: 'absolute', top: 12, right: 12 }}
        />
      ) : null}
    </Pressable>
  );
}
