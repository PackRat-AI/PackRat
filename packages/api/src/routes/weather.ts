import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  LocationSearchResponseSchema,
  type WeatherAPICurrentResponse,
  type WeatherAPIForecastResponse,
  type WeatherAPISearchResponse,
  WeatherCoordinateQuerySchema,
  WeatherForecastSchema,
  WeatherLocationIdSchema,
  WeatherSearchQuerySchema,
} from '@packrat/api/schemas/weather';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { z } from 'zod';
import { WeatherService } from '@packrat/api/services/weatherService';

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
      id: item.id,
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

      const currentData: WeatherAPICurrentResponse = await currentResponse.json();

      if (currentData?.location) {
        // Create a single result from the current conditions response
        return c.json(
          [
            {
              id: currentData.location.id,
              name: currentData.location.name,
              region: currentData.location.region,
              country: currentData.location.country,
              lat: Number.parseFloat(String(currentData.location.lat)),
              lon: Number.parseFloat(String(currentData.location.lon)),
            },
          ],
          200,
        );
      }
    }

    // Transform API response to our LocationSearchResult type
    const locations = data.map((item) => ({
      id: item.id,
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
    query: WeatherLocationIdSchema,
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

  const idParam = c.req.query('id');
  const id = Number(idParam);

  if (!idParam || Number.isNaN(id)) {
    return c.json({ error: 'Valid location ID is required' }, 400);
  }

  try {
    const query = `id:${id}`;

    // Get forecast data with all the details we need
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=10&aqi=yes&alerts=yes`,
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: WeatherAPIForecastResponse = await response.json();
    const result = {
      ...data,
      location: {
        ...data.location,
        id: Number(id),
      },
    };

    return c.json(result, 200);
  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    c.get('sentry').setContext('params', {
      id,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    return c.json({ error: 'Internal server error', code: 'WEATHER_FORECAST_ERROR' }, 500);
  }
});

// Trip weather outlook endpoint
const tripWeatherSchema = z.object({
  location: z.string().min(1, 'Location is required'),
  duration: z.number().min(1).max(14).default(3),
});

type TripWeatherResponse = {
  location: string;
  duration: number;
  forecast: Array<{
    date: string;
    tempHigh: number;
    tempLow: number;
    conditions: string;
    precipitation: number;
    windSpeed: number;
  }>;
  summary: {
    avgTempHigh: number;
    avgTempLow: number;
    rainDays: number;
    condition: string;
    recommendation: string;
  };
};

const tripWeatherRoute = createRoute({
  method: 'post',
  path: '/trip-outlook',
  tags: ['Weather'],
  summary: 'Get trip weather outlook',
  description:
    'Get weather outlook for a trip including forecast and recommendations based on trip duration',
  security: [{ bearerAuth: [] }],
  request: {
    content: {
      'application/json': {
        schema: tripWeatherSchema,
      },
    },
  },
  responses: {
    200: {
      description: 'Trip weather outlook',
      content: {
        'application/json': {
          schema: z.object({
            location: z.string(),
            duration: z.number(),
            forecast: z.array(
              z.object({
                date: z.string(),
                tempHigh: z.number(),
                tempLow: z.number(),
                conditions: z.string(),
                precipitation: z.number(),
                windSpeed: z.number(),
              }),
            ),
            summary: z.object({
              avgTempHigh: z.number(),
              avgTempLow: z.number(),
              rainDays: z.number(),
              condition: z.string(),
              recommendation: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request',
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

weatherRoutes.openapi(tripWeatherRoute, async (c) => {
  try {
    const body = await c.req.json();
    const { location, duration } = tripWeatherSchema.parse(body);

    const service = new WeatherService(c);
    const outlook = await service.getTripWeatherOutlook(location, duration);

    return c.json(outlook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    console.error('Error fetching trip weather outlook:', error);
    return c.json({ error: 'Failed to fetch trip weather outlook' }, 500);
  }
});

export { weatherRoutes };
