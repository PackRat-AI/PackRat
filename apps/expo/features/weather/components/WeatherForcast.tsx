import { Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { ScrollView, View } from 'react-native';
import { WeatherIcon } from './WeatherIcon';

export interface HourlyForecastItem {
  time: string;
  temp: number;
  weatherCode: number;
  isDay: number;
}

export interface DailyForecastItem {
  day: string;
  icon: string;
  low: number;
  high: number;
}

export interface WeatherDetails {
  feelsLike?: number;
  humidity?: number;
  visibility?: number;
  uvIndex?: number;
  windSpeed?: number;
}

interface WeatherForecastProps {
  hourlyForecast?: HourlyForecastItem[];
  dailyForecast?: DailyForecastItem[];
  details?: WeatherDetails;
  temperature?: number;
}

export function WeatherForecast({
  hourlyForecast,
  dailyForecast,
  details,
  temperature,
}: WeatherForecastProps) {
  const { t } = useTranslation();

  return (
    <>
      <View className="mt-8 rounded-xl bg-white/10 p-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {hourlyForecast ? (
            hourlyForecast.map((hour, index) => (
              <View key={hour.time} className="mr-4 min-w-[50px] items-center">
                <Text className="text-white">{index === 0 ? t('weather.now') : hour.time}</Text>
                <WeatherIcon
                  code={hour.weatherCode}
                  isDay={hour.isDay}
                  color="white"
                  size={24}
                  className="my-2"
                />
                <Text className="text-white">{hour.temp}°</Text>
              </View>
            ))
          ) : (
            <View className="w-full items-center justify-center py-4">
              <Text className="text-white/80">{t('weather.hourlyForecastNotAvailable')}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View className="mt-4 rounded-xl bg-white/10 p-4">
        <Text className="mb-2 font-medium text-white">
          {dailyForecast
            ? t('weather.dayForecast', { count: dailyForecast.length })
            : t('weather.dailyForecast')}
        </Text>
        {dailyForecast ? (
          dailyForecast.map((day, index) => (
            <View
              key={day.day}
              className={cn(
                'flex-row items-center justify-between py-3',
                index !== (dailyForecast?.length || 0) - 1 && 'border-b border-white/10',
              )}
            >
              <Text className="min-w-[40px] text-white">{day.day}</Text>
              <Icon name={day.icon} color="white" size={24} />
              <View className="flex-1 flex-row items-center px-4">
                <View className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                  <View
                    className="absolute h-1 bg-white"
                    style={{
                      left: `${Math.max(0, ((day.low - 40) / (100 - 40)) * 100)}%`,
                      right: `${Math.max(0, 100 - ((day.high - 40) / (100 - 40)) * 100)}%`,
                    }}
                  />
                </View>
              </View>
              <Text className="min-w-[30px] text-right text-white/90">{day.low}°</Text>
              <Text className="min-w-[30px] text-right text-white">{day.high}°</Text>
            </View>
          ))
        ) : (
          <View className="items-center justify-center py-4">
            <Text className="text-white/80">{t('weather.dailyForecastNotAvailable')}</Text>
          </View>
        )}
      </View>
      <View className="mb-6 mt-4 rounded-xl bg-white/10 p-4">
        <Text className="mb-2 font-medium text-white">{t('weather.details')}</Text>
        <View className="flex-row flex-wrap">
          <View className="w-1/2 p-2">
            <Text className="text-white/70">{t('weather.feelsLike')}</Text>
            <Text className="text-xl text-white">{details?.feelsLike || temperature}°</Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-white/70">{t('weather.humidity')}</Text>
            <Text className="text-xl text-white">{details?.humidity || '62'}%</Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-white/70">{t('weather.visibility')}</Text>
            <Text className="text-xl text-white">{details?.visibility || '10'} mi</Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-white/70">{t('weather.uvIndex')}</Text>
            <Text className="text-xl text-white">
              {details?.uvIndex || '6'}{' '}
              {details?.uvIndex && details.uvIndex > 5 ? t('weather.high') : ''}
            </Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-white/70">{t('weather.wind')}</Text>
            <Text className="text-xl text-white">{details?.windSpeed || '5'} mph</Text>
          </View>
        </View>
      </View>
    </>
  );
}
