import { Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import {
  formatWeatherData,
  getWeatherBackgroundColors,
  getWeatherData,
} from 'expo-app/features/weather/lib/weatherService';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeatherIcon } from '../components';
import { useLocations } from '../hooks';
import type { WeatherLocation } from '../types';

export default function LocationPreviewScreen() {
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { displayTemperature } = useTemperatureUnit();
  const { displayWindSpeed, displayVisibility } = useSpeedUnit();
  const { addLocation } = useLocations();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherLocation | null>(null);
  const [gradientColors, setGradientColors] = useState<[string, string, ...string[]]>([
    '#4c669f',
    '#3b5998',
    '#192f6a',
  ]);

  const _latitude = Number.parseFloat(params.lat as string);
  const _longitude = Number.parseFloat(params.lon as string);
  const locationId = Number.parseInt(String(params.id), 10);

  const loadWeatherData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getWeatherData(locationId);
      if (data) {
        const formattedData = formatWeatherData(data);
        // safe-cast: formattedData is shaped by weatherService which guarantees WeatherLocation structure
        setWeatherData(formattedData as unknown as WeatherLocation);

        if (formattedData.details) {
          const weatherCode = formattedData.details.weatherCode || 1000;
          const isNight = formattedData.details.isDay === 0;
          setGradientColors(getWeatherBackgroundColors({ code: weatherCode, isNight }));
        }
      } else {
        setError(t('weather.failedToLoadWeather'));
      }
    } catch (err) {
      console.error('Error loading weather data:', err);
      setError(t('weather.errorLoadingWeather'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeatherData();
  }, []);

  const handleSaveLocation = async () => {
    if (!weatherData) return;

    setIsSaving(true);

    try {
      addLocation(weatherData);

      Alert.alert(
        t('weather.locationSaved'),
        t('weather.locationSavedMessage', { name: weatherData.name }),
        [
          {
            text: t('weather.viewAllLocations'),
            onPress: () => router.replace('/weather'),
          },
          {
            text: t('common.ok'),
            onPress: () => router.back(),
          },
        ],
      );
    } catch (err) {
      console.error('Error saving location:', err);
      Alert.alert(t('common.error'), t('weather.errorSavingLocation'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: 'white',
          headerLeft:
            Platform.OS === 'ios'
              ? () => (
                  <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Icon name="chevron-left" color="white" size={28} />
                  </TouchableOpacity>
                )
              : undefined,
          headerRight:
            !isLoading && !error && weatherData
              ? () => (
                  <TouchableOpacity
                    className="rounded-full px-4 py-2"
                    onPress={handleSaveLocation}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-white text-base">{t('weather.saveLocation')}</Text>
                    )}
                  </TouchableOpacity>
                )
              : undefined,
        }}
      />

      <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingBottom: insets.bottom + 20,
            paddingTop: Platform.OS === 'android' ? insets.top + 56 : 0,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-4">
            {isLoading ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color="white" />
                <Text className="mt-4 text-white">{t('weather.loadingWeather')}</Text>
              </View>
            ) : error ? (
              <View className="items-center justify-center py-20">
                <Icon name="bell-outline" color="white" size={40} />
                <Text className="mt-4 text-white">{error}</Text>
                <TouchableOpacity
                  className="mt-4 rounded-full bg-black/25 px-4 py-2"
                  onPress={loadWeatherData}
                >
                  <Text className="text-white">{t('weather.tryAgain')}</Text>
                </TouchableOpacity>
              </View>
            ) : weatherData ? (
              <>
                {/* Location name and current weather */}
                <View className="mt-8 items-center">
                  <View className="flex-row items-center">
                    <Text className="text-3xl font-semibold text-white">{weatherData.name}</Text>
                  </View>
                  <Text className="text-lg text-white/80">{weatherData.time}</Text>
                  <Text className="mt-6 text-8xl font-light text-white">
                    {displayTemperature(weatherData.temperature)}
                  </Text>
                  <Text className="text-xl text-white">{weatherData.condition}</Text>
                  <Text className="mt-1 text-white/80">
                    H:{displayTemperature(weatherData.highTemp)} L:
                    {displayTemperature(weatherData.lowTemp)}
                  </Text>

                  {/* Refresh button */}
                  <TouchableOpacity
                    className="mt-2 flex-row items-center gap-2 px-4 py-2"
                    onPress={loadWeatherData}
                    disabled={isLoading}
                  >
                    <Icon name="restart" color="white" size={20} />
                    <Text className="text-white">
                      {isLoading ? t('weather.refreshing') : t('weather.refresh')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Hourly forecast */}
                <View className="mt-8 rounded-xl bg-white/10 p-4">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {weatherData.hourlyForecast ? (
                      weatherData.hourlyForecast.map((hour, index) => (
                        <View key={hour.time} className="mr-4 min-w-[50px] items-center">
                          <Text className="text-white">
                            {index === 0 ? t('weather.now') : hour.time}
                          </Text>
                          <WeatherIcon
                            code={hour.weatherCode}
                            isDay={hour.isDay}
                            color="white"
                            size={24}
                            className="my-2"
                          />
                          <Text className="text-white">{displayTemperature(hour.temp)}</Text>
                        </View>
                      ))
                    ) : (
                      <View className="w-full items-center justify-center py-4">
                        <Text className="text-white/80">
                          {t('weather.hourlyForecastNotAvailable')}
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>

                {/* Daily forecast */}
                <View className="mt-4 rounded-xl bg-white/10 p-4">
                  <Text className="mb-2 font-medium text-white">
                    {weatherData.dailyForecast
                      ? t('weather.dayForecast', {
                          count: weatherData.dailyForecast.length,
                        })
                      : t('weather.dailyForecast')}
                  </Text>
                  {weatherData.dailyForecast ? (
                    weatherData.dailyForecast.map((day, index) => (
                      <View
                        key={day.day}
                        className={cn(
                          'flex-row items-center justify-between py-3',
                          index !== (weatherData.dailyForecast?.length || 0) - 1 &&
                            'border-b border-white/10',
                        )}
                      >
                        <Text className="min-w-[40px] text-white">{day.day}</Text>
                        <WeatherIcon code={day.weatherCode} isDay={1} color="white" size={24} />
                        <View className="flex-1 flex-row items-center px-4">
                          <View className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                            <View
                              className="absolute h-1 bg-white"
                              style={{
                                left: `${Math.max(0, ((day.low - 4) / (38 - 4)) * 100)}%`,
                                right: `${Math.max(0, 100 - ((day.high - 4) / (38 - 4)) * 100)}%`,
                              }}
                            />
                          </View>
                        </View>
                        <Text className="min-w-[30px] text-right text-white/90">
                          {displayTemperature(day.low)}
                        </Text>
                        <Text className="min-w-[30px] text-right text-white">
                          {displayTemperature(day.high)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View className="items-center justify-center py-4">
                      <Text className="text-white/80">
                        {t('weather.dailyForecastNotAvailable')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Weather details */}
                <View className="mb-6 mt-4 rounded-xl bg-white/10 p-4">
                  <Text className="mb-2 font-medium text-white">{t('weather.details')}</Text>
                  <View className="flex-row flex-wrap">
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">{t('weather.feelsLike')}</Text>
                      <Text className="text-xl text-white">
                        {displayTemperature(
                          weatherData.details?.feelsLike ?? weatherData.temperature,
                        )}
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">{t('weather.humidity')}</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.humidity || '62'}%
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">{t('weather.visibility')}</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.visibility != null
                          ? displayVisibility(weatherData.details.visibility)
                          : '—'}
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">{t('weather.uvIndex')}</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.uvIndex || '6'}{' '}
                        {weatherData.details?.uvIndex && weatherData.details.uvIndex > 5
                          ? t('weather.high')
                          : ''}
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">{t('weather.wind')}</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.windSpeed != null
                          ? displayWindSpeed(weatherData.details.windSpeed)
                          : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </LinearGradient>
    </>
  );
}
