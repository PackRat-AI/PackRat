import { Icon } from 'expo-app/components/Icon';
import { WeatherForecast } from 'expo-app/features/weather/components/WeatherForecast';
import { getWeatherBackgroundColors } from 'expo-app/features/weather/lib/weatherService';
import type {
  ForecastDay as WeatherForecastDay,
  HourWeather as WeatherHourlyForecast,
  WeatherApiForecastResponse,
} from 'expo-app/features/weather/types';
import axiosInstance from 'expo-app/lib/api/client';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function TripWeatherDetailsScreen() {
  const { lat, lon } = useLocalSearchParams();

  const latitude = Number(lat);
  const longitude = Number(lon);

  const [weather, setWeather] = useState<WeatherApiForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradientColors, setGradientColors] = useState<[string, string, ...string[]]>([
    '#4c669f',
    '#3b5998',
    '#192f6a',
  ]);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);

      const locations = await axiosInstance.get(`/api/weather/search-by-coordinates`, {
        params: {
          lat: latitude.toFixed(6),
          lon: longitude.toFixed(6),
        },
      });
      const { id } = locations.data[0];
      const weather = await axiosInstance.get(`/api/weather/forecast`, {
        params: {
          id,
        },
      });

      setWeather(weather.data);
      const weatherCode = weather.data.current?.condition?.code || 1000;
      const isNight = weather.data.current?.is_day === 0;

      setGradientColors(getWeatherBackgroundColors(weatherCode, isNight));
    } catch (e) {
      console.error(e);
      setError('Failed to load weather');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !weather) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>{error || 'Something went wrong'}</Text>
        <TouchableOpacity onPress={fetchWeather}>
          <Text>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const location = weather.location;
  const current = weather.current;
  const todayForecast = weather.forecast.forecastday[0];

  const hourlyForecast = weather?.forecast?.forecastday?.[0]?.hour?.map(
    (h: WeatherHourlyForecast) => ({
      time: `${String(new Date(h.time).getHours())}:00`,
      temp: Math.round(h.temp_c),
      weatherCode: h.condition?.code ?? 1000,
      isDay: h.is_day,
    }),
  );

  const dailyForecast = weather?.forecast?.forecastday?.map((fd: WeatherForecastDay) => ({
    day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(fd.date)),
    icon: 'weather-partly-cloudy',
    low: Math.round(fd.day.mintemp_c),
    high: Math.round(fd.day.maxtemp_c),
  }));

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
        <View className="absolute top-10 left-4 z-10">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <Icon name="arrow-left" color="white" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingTop: 100, paddingBottom: 40 }}>
          <View className="items-center">
            <Text className="text-3xl text-white font-semibold">{location.name}</Text>

            <Text className="text-7xl text-white mt-6">{current.temp_c}°</Text>

            <Text className="text-xl text-white">{current.condition.text}</Text>

            <Text className="text-white/80 mt-2">
              {todayForecast
                ? `H:${todayForecast.day.maxtemp_c}° L:${todayForecast.day.mintemp_c}°`
                : 'H:— L:—'}
            </Text>
          </View>
          <WeatherForecast
            hourlyForecast={hourlyForecast}
            dailyForecast={dailyForecast}
            details={{
              feelsLike: Math.round(current.feelslike_c),
              humidity: current.humidity,
              visibility: current.vis_km,
              uvIndex: current.uv,
              windSpeed: Math.round(current.wind_kph),
            }}
            temperature={Math.round(current.temp_c)}
          />
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
