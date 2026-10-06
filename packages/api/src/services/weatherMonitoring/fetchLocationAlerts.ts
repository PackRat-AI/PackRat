import { getEnv } from '@packrat/api/utils/env-validation';
import {
  type WeatherAlertItem,
  WeatherAlertItemSchema,
  type WeatherAPIForecastResponse,
  WeatherAPIForecastResponseSchema,
} from '@packrat/schemas/weather';
import { z } from 'zod';

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

const CoordinateAlertsResponseSchema = z.object({
  alerts: z.object({ alert: z.array(WeatherAlertItemSchema).optional() }).optional(),
});

/**
 * Current alerts at a coordinate — a trip's destination, which is a point the
 * user picked rather than a WeatherAPI location id. Only the alert block is
 * validated; the forecast itself isn't used.
 */
export async function fetchCoordinateAlerts({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<WeatherAlertItem[]> {
  const { WEATHER_API_KEY } = getEnv();
  const q = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const response = await fetch(
    `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}&days=1&alerts=yes`,
  );
  if (!response.ok) {
    throw new Error(`WeatherAPI HTTP ${response.status} for ${q}`);
  }
  const parsed = CoordinateAlertsResponseSchema.parse(await response.json());
  return parsed.alerts?.alert ?? [];
}
