import { z } from 'zod';
import { call } from '../client';
import { GetWeatherOutputSchema } from '../output-schemas';
import type { AgentContext } from '../types';

export function registerWeatherTools(agent: AgentContext): void {
  // ── Get weather (single API call) ─────────────────────────────────────────
  agent.server.registerTool(
    'packrat_get_weather',
    {
      title: 'Get Weather Forecast',
      description:
        'Get current weather conditions and multi-day forecast for any location. Returns temperature, precipitation, wind, humidity, and outdoor conditions relevant to trip planning.',
      inputSchema: {
        location: z
          .string()
          .min(2)
          .describe('Location to get weather for (city, trail, park, etc.)'),
      },
      // U8: tier-1 structured output. The provider-specific WeatherAPI
      // shape is modeled loosely (passthrough on extra keys) so a
      // downstream provider field rename doesn't fail validation in
      // production before we can ship a fix.
      outputSchema: GetWeatherOutputSchema.shape,
      annotations: {
        title: 'Get Weather Forecast',
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ location }) =>
      call({
        promise: agent.api.user.weather['by-name'].get({ query: { q: location } }),
        action: 'fetch weather forecast',
        resourceHint: location,
        structured: true,
      }),
  );

  // ── Search weather location ───────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_search_weather_location',
    {
      title: 'Search Weather Locations',
      description: 'Search for weather locations by name. Returns matching locations with IDs.',
      inputSchema: { query: z.string().min(2) },
      annotations: {
        title: 'Search Weather Locations',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query }) =>
      call({
        promise: agent.api.user.weather.search.get({ query: { q: query } }),
        action: 'search weather location',
        resourceHint: query,
      }),
  );

  // ── Search weather location by coordinates ────────────────────────────────

  agent.server.registerTool(
    'packrat_search_weather_by_coordinates',
    {
      title: 'Search Weather By Coordinates',
      description: 'Find weather locations near a latitude/longitude pair.',
      inputSchema: {
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      },
      annotations: {
        title: 'Search Weather By Coordinates',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ latitude, longitude }) =>
      call({
        promise: agent.api.user.weather['search-by-coordinates'].get({
          query: { lat: String(latitude), lon: String(longitude) },
        }),
        action: 'search weather by coordinates',
      }),
  );

  // ── Forecast by location id ───────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_get_weather_forecast',
    {
      title: 'Get Weather Forecast By Location ID',
      description:
        'Fetch a 10-day forecast given a WeatherAPI location ID (returned by packrat_search_weather_location).',
      inputSchema: { location_id: z.union([z.string(), z.number()]) },
      annotations: {
        title: 'Get Weather Forecast By Location ID',
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ location_id }) =>
      call({
        promise: agent.api.user.weather.forecast.get({ query: { id: String(location_id) } }),
        action: 'get weather forecast',
        resourceHint: `location ${location_id}`,
      }),
  );
}
