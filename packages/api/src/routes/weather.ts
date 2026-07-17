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
import { first } from '@packrat/utils';
import { Elysia, status } from 'elysia';
import { ZodError } from 'zod';

const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';
const COORDINATE_QUERY_REGEX = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

const isE2EWeatherStubKey = (key?: string) => key?.startsWith('weather-e2e-stub-') === true;

const stubCondition = {
  text: 'Partly cloudy',
  icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
  code: 1003,
};

const buildStubCurrent = (tempF = 72): WeatherAPIForecastResponse['current'] => ({
  last_updated: '2026-07-16 12:00',
  temp_c: Math.round(((tempF - 32) * 5) / 9),
  temp_f: tempF,
  condition: stubCondition,
  wind_mph: 7,
  wind_kph: 11,
  wind_degree: 240,
  wind_dir: 'WSW',
  pressure_mb: 1016,
  pressure_in: 30.0,
  precip_mm: 0,
  precip_in: 0,
  humidity: 32,
  cloud: 25,
  feelslike_c: Math.round(((tempF - 32) * 5) / 9),
  feelslike_f: tempF,
  vis_km: 16,
  vis_miles: 10,
  uv: 5,
  is_day: 1,
  gust_mph: 14,
  gust_kph: 22,
});

const buildStubForecastDay = (
  dayOffset: number,
): WeatherAPIForecastResponse['forecast']['forecastday'][number] => {
  const date = new Date(Date.UTC(2026, 6, 16 + dayOffset));
  const highF = 78 + (dayOffset % 3);
  const lowF = 55 + (dayOffset % 2);
  return {
    date: date.toISOString().slice(0, 10),
    date_epoch: Math.floor(date.getTime() / 1000),
    day: {
      maxtemp_c: Math.round(((highF - 32) * 5) / 9),
      maxtemp_f: highF,
      mintemp_c: Math.round(((lowF - 32) * 5) / 9),
      mintemp_f: lowF,
      avgtemp_c: Math.round((((highF + lowF) / 2 - 32) * 5) / 9),
      avgtemp_f: (highF + lowF) / 2,
      maxwind_mph: 18,
      maxwind_kph: 29,
      totalprecip_mm: dayOffset === 2 ? 1.2 : 0,
      totalprecip_in: dayOffset === 2 ? 0.05 : 0,
      totalsnow_cm: 0,
      avghumidity: 35,
      avgvis_km: 16,
      avgvis_miles: 10,
      uv: 5,
      condition: stubCondition,
      daily_chance_of_rain: dayOffset === 2 ? 30 : 5,
      daily_chance_of_snow: 0,
    },
    astro: {
      sunrise: '05:48 AM',
      sunset: '08:27 PM',
      moonrise: '10:15 PM',
      moonset: '07:12 AM',
      moon_phase: 'Waxing Crescent',
      moon_illumination: 18,
    },
    hour: [],
  };
};

type StubWeatherLocation = WeatherAPISearchResponse[number];

const defaultStubLocation: StubWeatherLocation = {
  id: 5419384,
  name: 'Denver',
  region: 'Colorado',
  country: 'United States',
  lat: 39.74,
  lon: -104.98,
  url: 'denver-colorado-united-states-of-america',
};

const stubLocations: [StubWeatherLocation, ...StubWeatherLocation[]] = [
  defaultStubLocation,
  {
    id: 5400000,
    name: 'Yosemite Valley',
    region: 'California',
    country: 'United States',
    lat: 37.75,
    lon: -119.59,
    url: 'yosemite-valley-california-united-states-of-america',
  },
] satisfies [StubWeatherLocation, ...StubWeatherLocation[]];

const getStubLocation = (id?: number) =>
  stubLocations.find((location) => location.id === id) ?? defaultStubLocation;

const buildStubForecast = (id?: number): WeatherAPIForecastResponse => {
  const location = getStubLocation(id);
  return {
    location: {
      id: location.id,
      name: location.name,
      region: location.region,
      country: location.country,
      lat: location.lat,
      lon: location.lon,
      tz_id: location.name === 'Denver' ? 'America/Denver' : 'America/Los_Angeles',
      localtime_epoch: 1784246400,
      localtime: '2026-07-16 12:00',
    },
    current: buildStubCurrent(location.name === 'Denver' ? 72 : 68),
    forecast: {
      forecastday: Array.from({ length: 10 }, (_, index) => buildStubForecastDay(index)),
    },
    alerts: { alert: [] },
  };
};

const searchStubLocations = (query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  if (COORDINATE_QUERY_REGEX.test(normalizedQuery)) return [defaultStubLocation];
  return stubLocations.filter((location) =>
    `${location.name} ${location.region} ${location.country}`
      .toLowerCase()
      .includes(normalizedQuery),
  );
};

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

      if (isE2EWeatherStubKey(WEATHER_API_KEY)) {
        return searchStubLocations(q).map((item) => ({
          id: item.id,
          name: item.name,
          region: item.region,
          country: item.country,
          lat: item.lat,
          lon: item.lon,
        }));
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

      if (isE2EWeatherStubKey(WEATHER_API_KEY)) {
        return [
          {
            id: defaultStubLocation.id,
            name: defaultStubLocation.name,
            region: defaultStubLocation.region,
            country: defaultStubLocation.country,
            lat: defaultStubLocation.lat,
            lon: defaultStubLocation.lon,
          },
        ];
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

      if (isE2EWeatherStubKey(WEATHER_API_KEY)) {
        return WeatherAPIForecastResponseSchema.parse(buildStubForecast(id));
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

      if (isE2EWeatherStubKey(WEATHER_API_KEY)) {
        const firstMatch = first(searchStubLocations(q));
        if (!firstMatch) {
          return status(404, { error: `No weather location matched "${q}"` });
        }
        return WeatherAPIForecastResponseSchema.parse(buildStubForecast(firstMatch.id));
      }

      try {
        const searchResponse = await fetch(
          `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(q)}`,
        );
        if (!searchResponse.ok) throw new Error(`WeatherAPI HTTP ${searchResponse.status}`);
        const matches = (await searchResponse.json()) as WeatherAPISearchResponse; // safe-cast: WeatherAPI.com response shape matches this type
        const firstMatch = Array.isArray(matches) ? first(matches) : null;
        if (!firstMatch) {
          return status(404, { error: `No weather location matched "${q}"` });
        }
        const forecastResponse = await fetch(
          `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(`id:${firstMatch.id}`)}&days=10&aqi=yes&alerts=yes`,
        );
        if (!forecastResponse.ok) throw new Error(`WeatherAPI HTTP ${forecastResponse.status}`);
        const data = (await forecastResponse.json()) as WeatherAPIForecastResponse; // safe-cast: WeatherAPI.com response shape matches this type
        return {
          ...data,
          location: { ...data.location, id: Number(firstMatch.id) },
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
