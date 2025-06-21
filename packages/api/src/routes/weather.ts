import { Env } from "@/types/env";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/utils/api-middleware";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { env } from "hono/adapter";

const weatherRoutes = new OpenAPIHono();

const WEATHER_API_BASE_URL = "https://api.weatherapi.com/v1";

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
  const { WEATHER_API_KEY } = env<Env>(c);

  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const query = c.req.query("q");

  if (!query) {
    return c.json({ error: "Query parameter is required" }, 400);
  }

  try {
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform API response to our LocationSearchResult type
    const locations = data.map((item: any) => ({
      id: `${item.id || item.lat}_${item.lon}`,
      name: item.name,
      region: item.region,
      country: item.country,
      lat: item.lat,
      lon: item.lon,
    }));

    return c.json(locations);
  } catch (error) {
    console.error("Error searching locations:", error);
    return c.json({ error: "Failed to search locations" }, 500);
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
  const { WEATHER_API_KEY } = env<Env>(c);

  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const latitude = Number.parseFloat(c.req.query("lat") || "");
  const longitude = Number.parseFloat(c.req.query("lon") || "");

  if (isNaN(latitude) || isNaN(longitude)) {
    return c.json(
      { error: "Valid latitude and longitude parameters are required" },
      400
    );
  }

  try {
    // Format coordinates for the API query
    const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

    // Use the same search endpoint but with coordinates
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // If no results, try a reverse geocoding approach with current conditions API
    if (!data || data.length === 0) {
      const currentResponse = await fetch(
        `${WEATHER_API_BASE_URL}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`
      );

      if (!currentResponse.ok) {
        throw new Error(`API error: ${currentResponse.status}`);
      }

      const currentData = await currentResponse.json();

      if (currentData && currentData.location) {
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
    const locations = data.map((item: any) => ({
      id: `${item.id || item.lat}_${item.lon}`,
      name: item.name,
      region: item.region,
      country: item.country,
      lat: Number.parseFloat(item.lat),
      lon: Number.parseFloat(item.lon),
    }));

    return c.json(locations);
  } catch (error) {
    console.error("Error searching locations by coordinates:", error);
    return c.json({ error: "Failed to find locations near you" }, 500);
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
  const { WEATHER_API_KEY } = env<Env>(c);

  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const latitude = Number.parseFloat(c.req.query("lat") || "");
  const longitude = Number.parseFloat(c.req.query("lon") || "");

  if (isNaN(latitude) || isNaN(longitude)) {
    return c.json(
      { error: "Valid latitude and longitude parameters are required" },
      400
    );
  }

  try {
    // Format coordinates for the API query
    const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

    // Get forecast data with all the details we need
    const response = await fetch(
      `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=10&aqi=yes&alerts=yes`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("Error getting weather data:", error);
    return c.json({ error: "Failed to get weather data" }, 500);
  }
});

export { weatherRoutes };
