import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
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

// Get current weather endpoint
const currentWeatherQuerySchema = z
  .object({
    lat: z.string().optional(),
    lon: z.string().optional(),
    location: z.string().optional(),
  })
  .openapi('CurrentWeatherQuery');

const currentRoute = createRoute({
  method: 'get',
  path: '/current',
  tags: ['Weather'],
  summary: 'Get current weather',
  description: 'Retrieve current weather conditions for a location by coordinates or name',
  security: [{ bearerAuth: [] }],
  request: {
    query: currentWeatherQuerySchema,
  },
  responses: {
    200: {
      description: 'Current weather data',
      content: {
        'application/json': {
          schema: z.object({
            location: z.any(),
            current: z.any(),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Valid latitude and longitude or location name required',
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

weatherRoutes.openapi(currentRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  const latParam = c.req.query('lat');
  const lonParam = c.req.query('lon');
  const locationParam = c.req.query('location');

  let query: string;

  if (locationParam) {
    query = locationParam;
  } else if (latParam && lonParam) {
    const latitude = Number.parseFloat(latParam);
    const longitude = Number.parseFloat(lonParam);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return c.json({ error: 'Valid latitude and longitude parameters are required' }, 400);
    }

    // Validate latitude range (-90 to 90)
    if (latitude < -90 || latitude > 90) {
      return c.json({ error: 'latitude must be between -90 and 90 degrees' }, 400);
    }

    // Validate longitude range (-180 to 180)
    if (longitude < -180 || longitude > 180) {
      return c.json({ error: 'longitude must be between -180 and 180 degrees' }, 400);
    }

    query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  } else {
    return c.json(
      { error: 'Either lat and lon parameters or location parameter are required' },
      400,
    );
  }

  try {
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&aqi=yes`,
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: WeatherAPICurrentResponse = await response.json();

    return c.json(data, 200);
  } catch (error) {
    console.error('Error fetching current weather:', error);
    c.get('sentry').setContext('params', {
      query,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    return c.json({ error: 'Internal server error', code: 'WEATHER_CURRENT_ERROR' }, 500);
  }
});

// Get weather forecast endpoint (with lat/lon params)
const forecastQuerySchema = z
  .object({
    lat: z.string().optional(),
    lon: z.string().optional(),
    location: z.string().optional(),
    days: z.string().optional(),
  })
  .openapi('ForecastQuery');

const forecastWithCoordsRoute = createRoute({
  method: 'get',
  path: '/forecast',
  tags: ['Weather'],
  summary: 'Get weather forecast',
  description: 'Retrieve detailed weather forecast data by coordinates or location name',
  security: [{ bearerAuth: [] }],
  request: {
    query: forecastQuerySchema,
  },
  responses: {
    200: {
      description: 'Weather forecast data',
      content: {
        'application/json': {
          schema: z.object({
            location: z.any(),
            current: z.any().optional(),
            forecast: z.any(),
            alerts: z.any().optional(),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Valid parameters required',
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

weatherRoutes.openapi(forecastWithCoordsRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  const latParam = c.req.query('lat');
  const lonParam = c.req.query('lon');
  const locationParam = c.req.query('location');
  const daysParam = c.req.query('days');
  const idParam = c.req.query('id');

  // If ID is provided, use the existing forecast logic
  if (idParam) {
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      return c.json({ error: 'Valid location ID is required' }, 400);
    }

    try {
      const query = `id:${id}`;
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
        id: idParam,
        weatherApiUrl: WEATHER_API_BASE_URL,
        weatherApiKey: !!WEATHER_API_KEY,
      });
      return c.json({ error: 'Internal server error', code: 'WEATHER_FORECAST_ERROR' }, 500);
    }
  }

  // Otherwise use lat/lon or location
  let query: string;

  if (locationParam) {
    query = locationParam;
  } else if (latParam && lonParam) {
    const latitude = Number.parseFloat(latParam);
    const longitude = Number.parseFloat(lonParam);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return c.json({ error: 'Valid latitude and longitude parameters are required' }, 400);
    }

    // Validate latitude range
    if (latitude < -90 || latitude > 90) {
      return c.json({ error: 'latitude must be between -90 and 90 degrees' }, 400);
    }

    // Validate longitude range
    if (longitude < -180 || longitude > 180) {
      return c.json({ error: 'longitude must be between -180 and 180 degrees' }, 400);
    }

    query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  } else {
    return c.json(
      { error: 'Either lat and lon parameters, location parameter, or id parameter are required' },
      400,
    );
  }

  // Parse and validate days parameter
  let days = 3; // Default to 3 days
  if (daysParam) {
    const parsedDays = Number.parseInt(daysParam, 10);
    if (Number.isNaN(parsedDays) || parsedDays <= 0) {
      return c.json({ error: 'days parameter must be a positive number' }, 400);
    }
    if (parsedDays > 10) {
      return c.json({ error: 'days parameter cannot exceed 10' }, 400);
    }
    days = parsedDays;
  }

  try {
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=${days}&aqi=yes&alerts=yes`,
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: WeatherAPIForecastResponse = await response.json();

    return c.json(data, 200);
  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    c.get('sentry').setContext('params', {
      query,
      days,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    return c.json({ error: 'Internal server error', code: 'WEATHER_FORECAST_ERROR' }, 500);
  }
});

// Get weather alerts endpoint
const alertsRoute = createRoute({
  method: 'get',
  path: '/alerts',
  tags: ['Weather'],
  summary: 'Get weather alerts',
  description: 'Retrieve weather alerts for a location by coordinates',
  security: [{ bearerAuth: [] }],
  request: {
    query: WeatherCoordinateQuerySchema,
  },
  responses: {
    200: {
      description: 'Weather alerts data',
      content: {
        'application/json': {
          schema: z.object({
            alerts: z.any(),
          }),
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

weatherRoutes.openapi(alertsRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  const latParam = c.req.query('lat');
  const lonParam = c.req.query('lon');

  if (!latParam || !lonParam) {
    return c.json({ error: 'Latitude and longitude parameters are required' }, 400);
  }

  const latitude = Number.parseFloat(latParam);
  const longitude = Number.parseFloat(lonParam);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return c.json({ error: 'Valid latitude and longitude parameters are required' }, 400);
  }

  // Validate latitude range
  if (latitude < -90 || latitude > 90) {
    return c.json({ error: 'latitude must be between -90 and 90 degrees' }, 400);
  }

  // Validate longitude range
  if (longitude < -180 || longitude > 180) {
    return c.json({ error: 'longitude must be between -180 and 180 degrees' }, 400);
  }

  const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

  try {
    // Use forecast endpoint with alerts=yes to get alert data
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=1&aqi=no&alerts=yes`,
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: WeatherAPIForecastResponse = await response.json();

    // Return just the alerts portion
    return c.json(
      {
        alerts: data.alerts || { alert: [] },
      },
      200,
    );
  } catch (error) {
    console.error('Error fetching weather alerts:', error);
    c.get('sentry').setContext('params', {
      latitude,
      longitude,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    return c.json({ error: 'Internal server error', code: 'WEATHER_ALERTS_ERROR' }, 500);
  }
});

export { weatherRoutes };
