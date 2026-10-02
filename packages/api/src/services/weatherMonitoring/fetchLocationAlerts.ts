import { getEnv } from '@packrat/api/utils/env-validation';
import {
  type WeatherAlertItem,
  type WeatherAPIForecastResponse,
  WeatherAPIForecastResponseSchema,
} from '@packrat/schemas/weather';

const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';

/**
 * Fetches a single watched location's current alert set from WeatherAPI.com.
 * Mirrors the `/weather/forecast` route's request shape (see
 * packages/api/src/routes/weather.ts) but only the pieces the polling cron
 * needs — days=1 rather than the 10-day forecast the app screen renders.
 */
export async function fetchLocationAlerts(weatherLocationId: number): Promise<WeatherAlertItem[]> {
  const { WEATHER_API_KEY } = getEnv();
  const q = `id:${weatherLocationId}`;
  const response = await fetch(
    `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}&days=1&alerts=yes`,
  );
  if (!response.ok) {
    throw new Error(`WeatherAPI HTTP ${response.status} for location ${weatherLocationId}`);
  }

  const data = (await response.json()) as WeatherAPIForecastResponse; // safe-cast: WeatherAPI.com response shape matches this type
  const parsed = WeatherAPIForecastResponseSchema.parse({
    ...data,
    location: { ...data.location, id: weatherLocationId },
  });
  return parsed.alerts?.alert ?? [];
}
