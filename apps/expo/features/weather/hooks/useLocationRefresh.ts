import { useState } from 'react';
import { useLocations } from './useLocations';
import { getWeatherData, formatWeatherData } from '~/features/weather/lib/weatherService';

export function useLocationRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { locationsState, updateLocation } = useLocations();

  const refreshLocation = async (locationId: string) => {
    if (isRefreshing || locationsState.state !== 'hasData') return false;

    const location = locationsState.data.find((loc) => loc.id === locationId);
    if (!location) return false;

    setIsRefreshing(true);

    try {
      const weatherData = await getWeatherData(location.lat, location.lon);

      console.log('weatherData', JSON.stringify(weatherData));

      if (weatherData) {
        const formattedData = formatWeatherData(weatherData);

        updateLocation(locationId, {
          temperature: formattedData.temperature,
          condition: formattedData.condition,
          time: formattedData.time,
          highTemp: formattedData.highTemp,
          lowTemp: formattedData.lowTemp,
          alerts: formattedData.alerts,
          details: formattedData.details,
          hourlyForecast: formattedData.hourlyForecast,
          dailyForecast: formattedData.dailyForecast,
        });

        return true;
      }
      return false;
    } catch (err) {
      console.error('Error refreshing location:', err);
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
          const weatherData = await getWeatherData(location.lat, location.lon);

          if (weatherData) {
            const formattedData = formatWeatherData(weatherData);

            updateLocation(location.id, {
              temperature: formattedData.temperature,
              condition: formattedData.condition,
              time: formattedData.time,
              highTemp: formattedData.highTemp,
              lowTemp: formattedData.lowTemp,
              alerts: formattedData.alerts,
              details: formattedData.details,
              hourlyForecast: formattedData.hourlyForecast,
              dailyForecast: formattedData.dailyForecast,
            });
          }
        } catch (error) {
          console.error(`Error updating weather for ${location.name}:`, error);
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
