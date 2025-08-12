import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  LocationSearchResponseSchema,
  type WeatherAPIForecastResponse,
  type WeatherAPISearchResponse,
  WeatherCoordinateQuerySchema,
  WeatherForecastSchema,
  WeatherSearchQuerySchema,
} from '@packrat/api/schemas/weather';
import type { Variables } from '@packrat/api/types/variables';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';

const weatherRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';

// Search locations endpoint
const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Weather'],
  summary: 'Search locations',
  description: 'Search for locations by name to get weather data',
  security: [{ bearerAuth: [] }],
  request: {
    query: WeatherSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'Location search results',
      content: {
        'application/json': {
          schema: LocationSearchResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Query parameter required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - Invalid or missing authentication token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

weatherRoutes.openapi(searchRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  const query = c.req.query('q');

  if (!query) {
    return c.json({ error: 'Query parameter is required' }, 400);
  }

  try {
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`,
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: WeatherAPISearchResponse = await response.json();

    // Transform API response to our LocationSearchResult type
    const locations = data.map((item) => ({
      id: `${item.id || item.lat}_${item.lon}`,
      name: item.name,
      region: item.region,
      country: item.country,
      lat: typeof item.lat === 'string' ? Number.parseFloat(item.lat) : item.lat,
      lon: typeof item.lon === 'string' ? Number.parseFloat(item.lon) : item.lon,
    }));

    return c.json(locations, 200);
  } catch (error) {
    console.error('Error searching weather locations:', error);
    c.get('sentry').setContext('params', {
      query,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    return c.json({ error: 'Internal server error', code: 'WEATHER_SEARCH_ERROR' }, 500);
  }
});

// Search locations by coordinates endpoint
const searchByCoordRoute = createRoute({
  method: 'get',
  path: '/search-by-coordinates',
  tags: ['Weather'],
  summary: 'Search locations by coordinates',
  description: 'Find location information using latitude and longitude coordinates',
  security: [{ bearerAuth: [] }],
  request: {
    query: WeatherCoordinateQuerySchema,
  },
  responses: {
    200: {
      description: 'Location search results by coordinates',
      content: {
        'application/json': {
          schema: LocationSearchResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Valid latitude and longitude required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - Invalid or missing authentication token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

weatherRoutes.openapi(searchByCoordRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  const latitude = Number.parseFloat(c.req.query('lat') || '');
  const longitude = Number.parseFloat(c.req.query('lon') || '');

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return c.json({ error: 'Valid latitude and longitude parameters are required' }, 400);
  }

  try {
    // Format coordinates for the API query
    const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

    // Use the same search endpoint but with coordinates
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`,
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: WeatherAPISearchResponse = await response.json();

    // If no results, try a reverse geocoding approach with current conditions API
    if (!data || data.length === 0) {
      const currentResponse = await fetch(
        `${WEATHER_API_BASE_URL}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`,
      );

      if (!currentResponse.ok) {
        throw new Error(`API error: ${currentResponse.status}`);
      }

      const currentData: any = await currentResponse.json();

      if (currentData?.location) {
        // Create a single result from the current conditions response
        return c.json([
          {
            id: `${currentData.location.lat}_${currentData.location.lon}`,
            name: currentData.location.name,
            region: currentData.location.region,
            country: currentData.location.country,
            lat: Number.parseFloat(String(currentData.location.lat)),
            lon: Number.parseFloat(String(currentData.location.lon)),
          },
        ]);
      }
    }

    // Transform API response to our LocationSearchResult type
    const locations = data.map((item) => ({
      id: `${item.id || item.lat}_${item.lon}`,
      name: item.name,
      region: item.region,
      country: item.country,
      lat: typeof item.lat === 'string' ? Number.parseFloat(item.lat) : item.lat,
      lon: typeof item.lon === 'string' ? Number.parseFloat(item.lon) : item.lon,
    }));

    return c.json(locations, 200);
  } catch (error) {
    console.error('Error searching weather locations by coordinates:', error);
    c.get('sentry').setContext('params', {
      latitude,
      longitude,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    return c.json({ error: 'Internal server error', code: 'WEATHER_COORD_SEARCH_ERROR' }, 500);
  }
});

// Get weather data endpoint
const forecastRoute = createRoute({
  method: 'get',
  path: '/forecast',
  tags: ['Weather'],
  summary: 'Get weather forecast',
  description:
    'Retrieve detailed weather forecast data including current conditions, daily forecasts, and alerts',
  security: [{ bearerAuth: [] }],
  request: {
    query: WeatherCoordinateQuerySchema,
  },
  responses: {
    200: {
      description: 'Weather forecast data',
      content: {
        'application/json': {
          schema: WeatherForecastSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Valid latitude and longitude required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - Invalid or missing authentication token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

weatherRoutes.openapi(forecastRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  const latitude = Number.parseFloat(c.req.query('lat') || '');
  const longitude = Number.parseFloat(c.req.query('lon') || '');

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return c.json({ error: 'Valid latitude and longitude parameters are required' }, 400);
  }

  try {
    // Format coordinates for the API query
    const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

    // Get forecast data with all the details we need
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=10&aqi=yes&alerts=yes`,
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: WeatherAPIForecastResponse = await response.json();
    return c.json(data, 200);
  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    c.get('sentry').setContext('params', {
      latitude,
      longitude,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    return c.json({ error: 'Internal server error', code: 'WEATHER_FORECAST_ERROR' }, 500);
  }
});

export { weatherRoutes };
