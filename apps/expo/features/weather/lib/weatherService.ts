import {
  LocationSearchResponseSchema,
  type WeatherAPIForecastResponse,
  WeatherAPIForecastResponseSchema,
} from '@packrat/api/schemas/weather';
import { assertDefined } from '@packrat/guards';
import { apiClient } from 'expo-app/lib/api/packrat';
import { getWeatherIconName as getIconNameFromCode } from './weatherIcons';

/**
 * Search for locations by name
 */
export async function searchLocations(query: string) {
  const { data, error } = await apiClient.weather.search.get({ query: { q: query } });
  if (error) {
    console.error('Error searching locations:', error.value);
    throw new Error('Failed to search locations');
  }
  return LocationSearchResponseSchema.parse(data ?? []);
}

/**
 * Search for locations by coordinates
 */
export async function searchLocationsByCoordinates(latitude: number, longitude: number) {
  const { data, error } = await apiClient.weather['search-by-coordinates'].get({
    query: { lat: latitude.toFixed(6), lon: longitude.toFixed(6) },
  });
  if (error) {
    console.error('Error searching locations by coordinates:', error.value);
    throw new Error('Failed to find locations near you');
  }
  return LocationSearchResponseSchema.parse(data ?? []);
}

/**
 * Get detailed weather data for a location
 */
export async function getWeatherData(id: number) {
  const { data, error } = await apiClient.weather.forecast.get({ query: { id: String(id) } });
  if (error) {
    console.error('Error getting weather data:', error.value);
    throw new Error('Failed to get weather data');
  }
  return WeatherAPIForecastResponseSchema.parse(data);
}

/**
 * Format raw weather data into our application's format
 */
export function formatWeatherData(data: WeatherAPIForecastResponse) {
  // Extract location data
  const location = data.location;
  const current = data.current;
  const forecast = data.forecast;
  const alerts = data.alerts;

  // Format date and time
  const localTime = new Date(location.localtime);
  const formattedTime = localTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Get today's forecast
  const todayForecast = forecast.forecastday[0];
  assertDefined(todayForecast);

  // Format hourly forecast
  const hourlyForecast = todayForecast.hour
    .filter((hour) => {
      const hourTime = new Date(hour.time);
      return hourTime > localTime;
    })
    .slice(0, 24) // Get next 24 hours
    .map((hour) => {
      const hourTime = new Date(hour.time);
      return {
        time: hourTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          hour12: true,
        }),
        temp: Math.round(hour.temp_f),
        icon: getIconNameFromCode(hour.condition.code, hour.is_day),
        weatherCode: hour.condition.code,
        isDay: hour.is_day,
      };
    });

  // Format daily forecast
  const dailyForecast = forecast.forecastday.map((day) => {
    const date = new Date(day.date);
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      high: Math.round(day.day.maxtemp_f),
      low: Math.round(day.day.mintemp_f),
      icon: getIconNameFromCode(day.day.condition.code, 1), // Always use day icon for daily forecast
      weatherCode: day.day.condition.code,
    };
  });

  // Format alerts if any
  let alertText: string | undefined;
  if (alerts?.alert?.[0]) {
    alertText = alerts.alert[0].headline || 'Weather Alert';
  }

  return {
    id: location.id,
    name: location.name,
    temperature: Math.round(current.temp_f),
    condition: current.condition.text,
    time: formattedTime,
    highTemp: Math.round(todayForecast.day.maxtemp_f),
    lowTemp: Math.round(todayForecast.day.mintemp_f),
    alerts: alertText,
    lat: location.lat,
    lon: location.lon,
    details: {
      feelsLike: Math.round(current.feelslike_f),
      humidity: current.humidity,
      visibility: Math.round(current.vis_miles),
      uvIndex: current.uv,
      windSpeed: Math.round(current.wind_mph),
      weatherCode: current.condition.code,
      isDay: current.is_day,
    },
    hourlyForecast,
    dailyForecast,
  };
}

/**
 * Get background gradient colors based on weather condition
 */
export function getWeatherBackgroundColors(
  code: number,
  isNight: boolean,
): [string, string, string] {
  if (isNight) {
    if (code === 1000) return ['#1a2a3a', '#0c1824', '#05101a'];
    if (code >= 1003 && code <= 1009) return ['#2c3e50', '#1a2a3a', '#0c1824'];
    if (code >= 1030 && code <= 1039) return ['#4b6584', '#2c3e50', '#1a2a3a'];
    if (code >= 1063 && code <= 1069) return ['#3c6382', '#2c3e50', '#1a2a3a'];
    if (code >= 1087 && code <= 1117) return ['#2c2c54', '#1a1a2e', '#0c0c1a'];
    if (code >= 1150 && code <= 1201) return ['#3c6382', '#2c3e50', '#1a2a3a'];
    if (code >= 1204 && code <= 1237) return ['#4b6584', '#2c3e50', '#1a2a3a'];
    if (code >= 1240 && code <= 1246) return ['#3c6382', '#2c3e50', '#1a2a3a'];
    if (code >= 1249 && code <= 1264) return ['#4b6584', '#2c3e50', '#1a2a3a'];
    if (code >= 1273 && code <= 1282) return ['#2c2c54', '#1a1a2e', '#0c0c1a'];
  } else {
    if (code === 1000) return ['#4287f5', '#3a77d9', '#2e5eae'];
    if (code >= 1003 && code <= 1009) return ['#5d8bc3', '#4287f5', '#3a77d9'];
    if (code >= 1030 && code <= 1039) return ['#7a7a7a', '#5d6273', '#4a4e5c'];
    if (code >= 1063 && code <= 1069) return ['#5d6273', '#4a4e5c', '#3a3e49'];
    if (code >= 1087 && code <= 1117) return ['#525580', '#3a3e5c', '#2e3149'];
    if (code >= 1150 && code <= 1201) return ['#5d6273', '#4a4e5c', '#3a3e49'];
    if (code >= 1204 && code <= 1237) return ['#a3b8cc', '#8ca6b9', '#7590a3'];
    if (code >= 1240 && code <= 1246) return ['#5d6273', '#4a4e5c', '#3a3e49'];
    if (code >= 1249 && code <= 1264) return ['#7590a3', '#5d7a8c', '#4a6273'];
    if (code >= 1273 && code <= 1282) return ['#525580', '#3a3e5c', '#2e3149'];
  }

  return isNight ? ['#1a2a3a', '#0c1824', '#05101a'] : ['#4287f5', '#3a77d9', '#2e5eae'];
}
