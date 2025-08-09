import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { getEnv } from '@packrat/api/utils/env-validation';

const weatherRoutes = new OpenAPIHono();

const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';

// Search locations endpoint
const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  request: {
    query: z.object({
      q: z.string().optional(),
    }),
  },
  responses: {
    200: { description: 'Search locations' },
  },
});

weatherRoutes.openapi(searchRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

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

    const data = await response.json();

    // Transform API response to our LocationSearchResult type
    const locations = data.map(
      (item: {
        id: string;
        lat: string;
        lon: string;
        name: string;
        region: string;
        country: string;
      }) => ({
        id: `${item.id || item.lat}_${item.lon}`,
        name: item.name,
        region: item.region,
        country: item.country,
        lat: item.lat,
        lon: item.lon,
      }),
    );

    return c.json(locations);
  } catch (error) {
    c.get('sentry').setContext('params', {
      query,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    throw error;
  }
});

// Search locations by coordinates endpoint
const searchByCoordRoute = createRoute({
  method: 'get',
  path: '/search-by-coordinates',
  request: {
    query: z.object({
      lat: z.string().optional(),
      lon: z.string().optional(),
    }),
  },
  responses: {
    200: { description: 'Search locations by coordinates' },
  },
});

weatherRoutes.openapi(searchByCoordRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

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

    const data = await response.json();

    // If no results, try a reverse geocoding approach with current conditions API
    if (!data || data.length === 0) {
      const currentResponse = await fetch(
        `${WEATHER_API_BASE_URL}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`,
      );

      if (!currentResponse.ok) {
        throw new Error(`API error: ${currentResponse.status}`);
      }

      const currentData = await currentResponse.json();

      if (currentData?.location) {
        // Create a single result from the current conditions response
        return c.json([
          {
            id: `${currentData.location.lat}_${currentData.location.lon}`,
            name: currentData.location.name,
            region: currentData.location.region,
            country: currentData.location.country,
            lat: Number.parseFloat(currentData.location.lat),
            lon: Number.parseFloat(currentData.location.lon),
          },
        ]);
      }
    }

    // Transform API response to our LocationSearchResult type
    const locations = data.map(
      (item: {
        id: string;
        lat: string;
        lon: string;
        name: string;
        region: string;
        country: string;
      }) => ({
        id: `${item.id || item.lat}_${item.lon}`,
        name: item.name,
        region: item.region,
        country: item.country,
        lat: Number.parseFloat(item.lat),
        lon: Number.parseFloat(item.lon),
      }),
    );

    return c.json(locations);
  } catch (error) {
    c.get('sentry').setContext('params', {
      latitude,
      longitude,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    throw error;
  }
});

// Get weather data endpoint
const forecastRoute = createRoute({
  method: 'get',
  path: '/forecast',
  request: {
    query: z.object({
      lat: z.string().optional(),
      lon: z.string().optional(),
    }),
  },
  responses: {
    200: { description: 'Get weather forecast' },
  },
});

weatherRoutes.openapi(forecastRoute, async (c) => {
  const { WEATHER_API_KEY } = getEnv(c);

  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

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

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    c.get('sentry').setContext('params', {
      latitude,
      longitude,
      weatherApiUrl: WEATHER_API_BASE_URL,
      weatherApiKey: !!WEATHER_API_KEY,
    });
    throw error;
  }
});

export { weatherRoutes };
