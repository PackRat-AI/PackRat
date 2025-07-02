import { Icon } from '@roninoss/icons';
import {
  formatWeatherData,
  getWeatherBackgroundColors,
  getWeatherData,
} from 'expo-app/features/weather/lib/weatherService';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { Text } from 'nativewindui/Text';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeatherIcon } from '../components';
import { useLocations } from '../hooks';
import type { WeatherLocation } from '../types';

export default function LocationPreviewScreen() {
  const params = useLocalSearchParams();
  const { colors, colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { addLocation } = useLocations();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherLocation | null>(null);
  const [gradientColors, setGradientColors] = useState(['#4c669f', '#3b5998', '#192f6a']);

  // Extract location data from params
  const latitude = Number.parseFloat(params.lat as string);
  const longitude = Number.parseFloat(params.lon as string);
  const locationName = params.name as string;
  const region = params.region as string;
  const country = params.country as string;

  // Load weather data on initial render
  useEffect(() => {
    loadWeatherData();
  }, []);

  const loadWeatherData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getWeatherData(latitude, longitude);
      if (data) {
        const formattedData = formatWeatherData(data);
        setWeatherData(formattedData);

        // Update gradient colors based on weather condition
        if (formattedData.details) {
          const weatherCode = formattedData.details.weatherCode || 1000;
          const isNight = formattedData.details.isDay === 0;
          setGradientColors(getWeatherBackgroundColors(weatherCode, isNight));
        }
      } else {
        setError('Failed to load weather data');
      }
    } catch (err) {
      console.error('Error loading weather data:', err);
      setError('An error occurred while loading weather data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!weatherData) return;

    setIsSaving(true);

    try {
      addLocation(weatherData);

      Alert.alert('Location Saved', `${weatherData.name} has been added to your saved locations.`, [
        {
          text: 'View All Locations',
          onPress: () => router.replace('/weather'),
        },
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (err) {
      console.error('Error saving location:', err);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Determine if we should use light or dark status bar based on gradient colors
  const isDarkGradient =
    gradientColors[0].toLowerCase().startsWith('#4') ||
    gradientColors[0].toLowerCase().startsWith('#3') ||
    gradientColors[0].toLowerCase().startsWith('#2') ||
    gradientColors[0].toLowerCase().startsWith('#1');

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Status bar with matching style */}
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

      <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
        {/* Fixed header buttons */}
        <View
          style={{ paddingTop: insets.top + 10 }}
          className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-4"
        >
          <TouchableOpacity onPress={() => router.back()}>
            <View className="rounded-full bg-white/20 p-2">
              <Icon name="arrow-left" color="white" size={20} />
            </View>
          </TouchableOpacity>

          {!isLoading && !error && weatherData && (
            <TouchableOpacity
              className="rounded-full bg-white/20 px-4 py-2"
              onPress={handleSaveLocation}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white">Save Location</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingTop: insets.top + 50 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-4">
            {isLoading ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color="white" />
                <Text className="mt-4 text-white">Loading weather data...</Text>
              </View>
            ) : error ? (
              <View className="items-center justify-center py-20">
                <Icon name="bell-outline" color="white" size={40} />
                <Text className="mt-4 text-white">{error}</Text>
                <TouchableOpacity
                  className="mt-4 rounded-full bg-white/20 px-4 py-2"
                  onPress={loadWeatherData}
                >
                  <Text className="text-white">Try Again</Text>
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
                    {weatherData.temperature}°
                  </Text>
                  <Text className="text-xl text-white">{weatherData.condition}</Text>
                  <Text className="mt-1 text-white/80">
                    H:{weatherData.highTemp}° L:{weatherData.lowTemp}°
                  </Text>

                  {/* Refresh button */}
                  <TouchableOpacity
                    className="mt-2 flex-row items-center gap-2 rounded-full bg-white/20 px-4 py-2"
                    onPress={loadWeatherData}
                    disabled={isLoading}
                  >
                    <Icon name="restart" color="white" size={20} />
                    <Text className="text-white">{isLoading ? 'Refreshing...' : 'Refresh'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Hourly forecast */}
                <View className="mt-8 rounded-xl bg-white/10 p-4">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {weatherData.hourlyForecast ? (
                      weatherData.hourlyForecast.map((hour, index) => (
                        <View key={index} className="mr-4 min-w-[50px] items-center">
                          <Text className="text-white">{index === 0 ? 'Now' : hour.time}</Text>
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
                        <Text className="text-white/80">Hourly forecast not available</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>

                {/* Daily forecast */}
                <View className="mt-4 rounded-xl bg-white/10 p-4">
                  <Text className="mb-2 font-medium text-white">
                    {weatherData.dailyForecast
                      ? `${weatherData.dailyForecast.length}-DAY`
                      : 'DAILY'}{' '}
                    FORECAST
                  </Text>
                  {weatherData.dailyForecast ? (
                    weatherData.dailyForecast.map((day, index) => (
                      <View
                        key={index}
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
                      <Text className="text-white/80">Daily forecast not available</Text>
                    </View>
                  )}
                </View>

                {/* Weather details */}
                <View className="mb-6 mt-4 rounded-xl bg-white/10 p-4">
                  <Text className="mb-2 font-medium text-white">DETAILS</Text>
                  <View className="flex-row flex-wrap">
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">Feels Like</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.feelsLike || weatherData.temperature}°
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">Humidity</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.humidity || '62'}%
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">Visibility</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.visibility || '10'} mi
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">UV Index</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.uvIndex || '6'}{' '}
                        {weatherData.details?.uvIndex && weatherData.details.uvIndex > 5
                          ? '(High)'
                          : ''}
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">Wind</Text>
                      <Text className="text-xl text-white">
                        {weatherData.details?.windSpeed || '5'} mph
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
