import { useState } from 'react';
import {
  searchLocations,
  getWeatherData,
  formatWeatherData,
  searchLocationsByCoordinates,
} from '~/features/weather/lib/weatherService';
import type { LocationSearchResult, WeatherLocation } from '../types';
import { useLocations } from './useLocations';

export function useLocationSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { addLocation } = useLocations();

  const search = async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchLocations(query);
      setResults(searchResults);
    } catch (err) {
      console.error('Error searching locations:', err);
      setError('Failed to search locations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const searchByCoordinates = async (latitude: number, longitude: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchLocationsByCoordinates(latitude, longitude);

      if (searchResults.length === 0) {
        setError('No locations found near your current position. Please try searching manually.');
      } else {
        setResults(searchResults);
      }
    } catch (err) {
      console.error('Error searching locations by coordinates:', err);
      setError('Failed to find locations near you. Please try again or search manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const addSearchResult = async (result: LocationSearchResult) => {
    setIsLoading(true);

    try {
      // Get weather data for the selected location
      const weatherData = await getWeatherData(result.lat, result.lon);

      if (weatherData) {
        const formattedData = formatWeatherData(weatherData);

        // Create new location with weather data
        const newLocation: WeatherLocation = {
          id: formattedData.id,
          name: formattedData.name,
          temperature: formattedData.temperature,
          condition: formattedData.condition,
          time: formattedData.time,
          highTemp: formattedData.highTemp,
          lowTemp: formattedData.lowTemp,
          alerts: formattedData.alerts,
          lat: formattedData.lat,
          lon: formattedData.lon,
          details: formattedData.details,
          hourlyForecast: formattedData.hourlyForecast,
          dailyForecast: formattedData.dailyForecast,
        };

        addLocation(newLocation);
        return true;
      } else {
        setError('Failed to get weather data for this location');
        return false;
      }
    } catch (err) {
      console.error('Error adding location:', err);
      setError('Failed to add location. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    results,
    error,
    search,
    searchByCoordinates,
    addSearchResult,
  };
}
