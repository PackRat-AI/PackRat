import { z } from 'zod';
import { call, errMessage } from '../client';
import type { AgentContext } from '../types';

export function registerWeatherTools(agent: AgentContext): void {
  // ── Get weather (search + forecast combined) ──────────────────────────────
  // Candidate for API thickening: a single GET /weather/by-name?q=... would
  // collapse this two-step into one server call.

  agent.server.registerTool(
    'get_weather',
    {
      description:
        'Get current weather conditions and multi-day forecast for any location. Returns temperature, precipitation, wind, humidity, and outdoor conditions relevant to trip planning.',
      inputSchema: {
        location: z
          .string()
          .min(2)
          .describe('Location to get weather for (city, trail, park, etc.)'),
      },
    },
    async ({ location }) => {
      const search = await agent.api.user.weather.search.get({ query: { q: location } });
      if (search.error || !search.data) {
        return call(Promise.resolve(search), {
          action: 'search weather location',
          resourceHint: location,
        });
      }
      const first = Array.isArray(search.data) ? search.data[0] : null;
      const id = first && typeof first === 'object' && 'id' in first ? first.id : null;
      if (id == null) return errMessage(`No weather location found for: ${location}`);
      return call(agent.api.user.weather.forecast.get({ query: { id: String(id) } }), {
        action: 'fetch weather forecast',
        resourceHint: location,
      });
    },
  );

  // ── Search weather location ───────────────────────────────────────────────

  agent.server.registerTool(
    'search_weather_location',
    {
      description: 'Search for weather locations by name. Returns matching locations with IDs.',
      inputSchema: { query: z.string().min(2) },
    },
    async ({ query }) =>
      call(agent.api.user.weather.search.get({ query: { q: query } }), {
        action: 'search weather location',
        resourceHint: query,
      }),
  );

  // ── Search weather location by coordinates ────────────────────────────────

  agent.server.registerTool(
    'search_weather_by_coordinates',
    {
      description: 'Find weather locations near a latitude/longitude pair.',
      inputSchema: {
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      },
    },
    async ({ latitude, longitude }) =>
      call(
        agent.api.user.weather['search-by-coordinates'].get({
          query: { lat: latitude, lon: longitude },
        }),
        { action: 'search weather by coordinates' },
      ),
  );

  // ── Forecast by location id ───────────────────────────────────────────────

  agent.server.registerTool(
    'get_weather_forecast',
    {
      description:
        'Fetch a 10-day forecast given a WeatherAPI location ID (returned by search_weather_location).',
      inputSchema: { location_id: z.union([z.string(), z.number()]) },
    },
    async ({ location_id }) =>
      call(agent.api.user.weather.forecast.get({ query: { id: String(location_id) } }), {
        action: 'get weather forecast',
        resourceHint: `location ${location_id}`,
      }),
  );
}
