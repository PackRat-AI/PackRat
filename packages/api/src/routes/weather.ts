import { authPlugin } from '@packrat/api/middleware/auth';
import {
  type WeatherAPICurrentResponse,
  type WeatherAPIForecastResponse,
  type WeatherAPISearchResponse,
  WeatherCoordinateQuerySchema,
  WeatherLocationIdSchema,
  WeatherSearchQuerySchema,
} from '@packrat/api/schemas/weather';
import { getEnv } from '@packrat/api/utils/env-validation';
import { isString } from '@packrat/guards';
import { Elysia, status } from 'elysia';

const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';

export const weatherRoutes = new Elysia({ prefix: '/weather' })
  .use(authPlugin)
  .get(
    '/search',
    async ({ query }) => {
      const { WEATHER_API_KEY } = getEnv();
      const q = query.q;

      if (!q) {
        return status(400, { error: 'Query parameter is required' });
      }

      try {
        const response = await fetch(
          `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}`,
        );
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = (await response.json()) as WeatherAPISearchResponse; // safe-cast: WeatherAPI.com response shape matches this type

        return data.map((item) => ({
          id: item.id,
          name: item.name,
          region: item.region,
          country: item.country,
          lat: isString(item.lat) ? Number.parseFloat(item.lat) : item.lat,
          lon: isString(item.lon) ? Number.parseFloat(item.lon) : item.lon,
        }));
      } catch (error) {
        console.error('Error searching weather locations:', error);
        return status(500, { error: 'Internal server error', code: 'WEATHER_SEARCH_ERROR' });
      }
    },
    {
      query: WeatherSearchQuerySchema,
      isAuthenticated: true,
      detail: {
        tags: ['Weather'],
        summary: 'Search locations',
        description: 'Search for locations by name to get weather data',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/search-by-coordinates',
    async ({ query }) => {
      const { WEATHER_API_KEY } = getEnv();
      const latitude = Number.parseFloat(String(query.lat ?? ''));
      const longitude = Number.parseFloat(String(query.lon ?? ''));

      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return status(400, {
          error: 'Valid latitude and longitude parameters are required',
        });
      }

      try {
        const q = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        const response = await fetch(
          `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}`,
        );
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = (await response.json()) as WeatherAPISearchResponse; // safe-cast: WeatherAPI.com response shape matches this type

        if (!data || data.length === 0) {
          const currentResponse = await fetch(
            `${WEATHER_API_BASE_URL}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}`,
          );
          if (!currentResponse.ok) throw new Error(`API error: ${currentResponse.status}`);
          const currentData = (await currentResponse.json()) as WeatherAPICurrentResponse; // safe-cast: WeatherAPI.com response shape matches this type

          if (currentData?.location) {
            return [
              {
                id: currentData.location.id,
                name: currentData.location.name,
                region: currentData.location.region,
                country: currentData.location.country,
                lat: Number.parseFloat(String(currentData.location.lat)),
                lon: Number.parseFloat(String(currentData.location.lon)),
              },
            ];
          }
          return [];
        }

        return data.map((item) => ({
          id: item.id,
          name: item.name,
          region: item.region,
          country: item.country,
          lat: isString(item.lat) ? Number.parseFloat(item.lat) : item.lat,
          lon: isString(item.lon) ? Number.parseFloat(item.lon) : item.lon,
        }));
      } catch (error) {
        console.error('Error searching weather locations by coordinates:', error);
        return status(500, {
          error: 'Internal server error',
          code: 'WEATHER_COORD_SEARCH_ERROR',
        });
      }
    },
    {
      query: WeatherCoordinateQuerySchema,
      isAuthenticated: true,
      detail: {
        tags: ['Weather'],
        summary: 'Search locations by coordinates',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/forecast',
    async ({ query }) => {
      const { WEATHER_API_KEY } = getEnv();
      const idParam = query.id;
      const id = Number(idParam);

      if (!idParam || Number.isNaN(id)) {
        return status(400, { error: 'Valid location ID is required' });
      }

      try {
        const q = `id:${id}`;
        const response = await fetch(
          `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}&days=10&aqi=yes&alerts=yes`,
        );
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = (await response.json()) as WeatherAPIForecastResponse; // safe-cast: WeatherAPI.com response shape matches this type
        return {
          ...data,
          location: {
            ...data.location,
            id: Number(id),
          },
        };
      } catch (error) {
        console.error('Error fetching weather forecast:', error);
        return status(500, {
          error: 'Internal server error',
          code: 'WEATHER_FORECAST_ERROR',
        });
      }
    },
    {
      query: WeatherLocationIdSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Weather'],
        summary: 'Get weather forecast',
        description:
          'Retrieve detailed weather forecast data including current conditions, daily forecasts, and alerts',
        security: [{ bearerAuth: [] }],
      },
    },
  );
