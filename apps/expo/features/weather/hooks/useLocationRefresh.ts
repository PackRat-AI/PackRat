import * as Sentry from '@sentry/react-native';
import { formatWeatherData, getWeatherData } from 'expo-app/features/weather/lib/weatherService';
import { useState } from 'react';
import type { WeatherLocation } from '../types';
import { useLocations } from './useLocations';

export function useLocationRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { locationsState, updateLocation } = useLocations();

  const refreshLocation = async (locationId: number) => {
    if (isRefreshing || locationsState.state !== 'hasData') return false;

    setIsRefreshing(true);

    try {
      const weatherData = await getWeatherData(locationId);

      if (weatherData) {
        const formattedData = formatWeatherData(weatherData);

        updateLocation({
          locationId,
          // safe-cast: formattedData is shaped by weatherService which guarantees WeatherLocation structure
          updates: formattedData as unknown as Partial<WeatherLocation>,
        });

        return true;
      }
      return false;
    } catch (err) {
      console.error('Error refreshing location:', err);
      Sentry.captureException(err, {
        tags: { feature: 'weather', action: 'refreshLocation' },
        extra: { locationId },
      });
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshAllLocations = async () => {
    if (isRefreshing || locationsState.state !== 'hasData') return;

    const locations = locationsState.data;
    if (locations.length === 0) return;

    setIsRefreshing(true);

    try {
      for (const location of locations) {
        try {
          const weatherData = await getWeatherData(location.id);

          if (weatherData) {
            const formattedData = formatWeatherData(weatherData);

            updateLocation({
              locationId: location.id,
              // safe-cast: formattedData is shaped by weatherService which guarantees WeatherLocation structure
              updates: formattedData as unknown as Partial<WeatherLocation>,
            });
          }
        } catch (error) {
          console.error(`Error updating weather for ${location.name}:`, error);
          Sentry.captureException(error, {
            tags: { feature: 'weather', action: 'refreshAllLocations' },
            extra: { locationId: location.id, locationName: location.name },
          });
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    isRefreshing,
    refreshLocation,
    refreshAllLocations,
  };
}
