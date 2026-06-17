import { authPlugin } from '@packrat/api/middleware/auth';
import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { isString } from '@packrat/guards';
import {
  type WeatherAPICurrentResponse,
  type WeatherAPIForecastResponse,
  WeatherAPIForecastResponseSchema,
  type WeatherAPISearchResponse,
  WeatherByNameQuerySchema,
  WeatherCoordinateQuerySchema,
  WeatherLocationIdSchema,
  WeatherSearchQuerySchema,
} from '@packrat/schemas/weather';
import { Elysia, status } from 'elysia';
import { ZodError } from 'zod';

const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';

export const weatherRoutes = new Elysia({ prefix: '/weather' })
  .model({
    'weather.ForecastResponse': WeatherAPIForecastResponseSchema,
  })
  .use(authPlugin)
  .get(
    '/search',
    async ({ query, user }) => {
      const { WEATHER_API_KEY } = getEnv();
      const q = query.q;

      if (!q) {
        return status(400, { error: 'Query parameter is required' });
      }

      try {
        const response = await fetch(
          `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}`,
        );
        if (!response.ok) throw new Error(`WeatherAPI HTTP ${response.status}`);
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
        captureApiException({
          error: error,
          operation: 'weather.search',
          userId: user?.userId,
          tags: { weather_operation: 'search' },
          extra: { query: q, httpStatus: 500, errorCode: 'WEATHER_SEARCH_ERROR' },
        });
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
    async ({ query, user }) => {
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
        if (!response.ok) throw new Error(`WeatherAPI HTTP ${response.status}`);
        const data = (await response.json()) as WeatherAPISearchResponse; // safe-cast: WeatherAPI.com response shape matches this type

        if (!data || data.length === 0) {
          const currentResponse = await fetch(
            `${WEATHER_API_BASE_URL}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}`,
          );
          if (!currentResponse.ok) throw new Error(`WeatherAPI HTTP ${currentResponse.status}`);
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
        captureApiException({
          error: error,
          operation: 'weather.searchByCoordinates',
          userId: user?.userId,
          tags: { weather_operation: 'search_by_coordinates' },
          extra: { latitude, longitude, httpStatus: 500, errorCode: 'WEATHER_COORD_SEARCH_ERROR' },
        });
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
    async ({ query, user }) => {
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
        if (!response.ok) throw new Error(`WeatherAPI HTTP ${response.status}`);

        const data = (await response.json()) as WeatherAPIForecastResponse; // safe-cast: WeatherAPI.com response shape matches this type
        return WeatherAPIForecastResponseSchema.parse({
          ...data,
          location: {
            ...data.location,
            id: Number(id),
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          const invalidPaths = error.errors.map((e) => e.path.join('.')).join(', ');
          captureApiException({
            error: error,
            operation: 'weather.forecast.schemaValidation',
            userId: user?.userId,
            tags: { weather_operation: 'forecast', error_type: 'schema_validation' },
            extra: {
              locationId: id,
              invalidPaths,
              httpStatus: 500,
              errorCode: 'WEATHER_FORECAST_SCHEMA_ERROR',
            },
          });
          return status(500, { error: 'Internal server error', code: 'WEATHER_FORECAST_ERROR' });
        }
        captureApiException({
          error: error,
          operation: 'weather.forecast',
          userId: user?.userId,
          tags: { weather_operation: 'forecast' },
          extra: { locationId: id, httpStatus: 500, errorCode: 'WEATHER_FORECAST_ERROR' },
        });
        return status(500, { error: 'Internal server error', code: 'WEATHER_FORECAST_ERROR' });
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
  )
  // Combined search + forecast — pass a location name and get the forecast
  // directly. Saves the typical two-step (`/search` → `/forecast`) clients
  // were doing. Returns 404 if no location matches.
  .get(
    '/by-name',
    async ({ query, user }) => {
      const { WEATHER_API_KEY } = getEnv();
      // Schema enforces z.string().min(2); Elysia rejects shorter values
      // before the handler runs.
      const q = query.q;
      try {
        const searchResponse = await fetch(
          `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}`,
        );
        if (!searchResponse.ok) throw new Error(`WeatherAPI HTTP ${searchResponse.status}`);
        const matches = (await searchResponse.json()) as WeatherAPISearchResponse; // safe-cast: WeatherAPI.com response shape matches this type
        const first = Array.isArray(matches) ? matches[0] : null;
        if (!first) {
          return status(404, { error: `No weather location matched "${q}"` });
        }
        const forecastResponse = await fetch(
          `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(`id:${first.id}`)}&days=10&aqi=yes&alerts=yes`,
        );
        if (!forecastResponse.ok) throw new Error(`WeatherAPI HTTP ${forecastResponse.status}`);
        const data = (await forecastResponse.json()) as WeatherAPIForecastResponse; // safe-cast: WeatherAPI.com response shape matches this type
        return {
          ...data,
          location: { ...data.location, id: Number(first.id) },
        };
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'weather.byName',
          userId: user?.userId,
          tags: { weather_operation: 'by_name' },
          extra: { query: q, httpStatus: 500, errorCode: 'WEATHER_BY_NAME_ERROR' },
        });
        return status(500, {
          error: 'Internal server error',
          code: 'WEATHER_BY_NAME_ERROR',
        });
      }
    },
    {
      query: WeatherByNameQuerySchema,
      isAuthenticated: true,
      detail: {
        tags: ['Weather'],
        summary: 'Search and fetch forecast in one call',
        description:
          'Resolve the location query to the first match and return its 10-day forecast.',
        security: [{ bearerAuth: [] }],
      },
    },
  );
