import { z } from 'zod';
import { err, ok } from '../client';
import type { AgentContext } from '../types';

export function registerWeatherTools(agent: AgentContext): void {
  // ── Get weather ───────────────────────────────────────────────────────────
  // The PackRat weather API is a two-step flow:
  //   1. GET /weather/search?q=<location> → returns location matches with IDs
  //   2. GET /weather/forecast?id=<locationId> → returns the actual forecast
  // This tool combines both steps for a seamless experience.

  agent.server.registerTool(
    'get_weather',
    {
      description:
        'Get current weather conditions and multi-day forecast for any location. Returns temperature, precipitation, wind, humidity, and outdoor conditions relevant to trip planning. Works with city names, trail names, park names, or coordinates.',
      inputSchema: {
        location: z
          .string()
          .min(2)
          .describe(
            'Location to get weather for. Examples: "Yosemite Valley, CA", "Mt. Whitney Summit", "Seattle, WA", "37.8651,-119.5383"',
          ),
      },
    },
    async ({ location }) => {
      try {
        // Step 1: search for the location to get its ID
        const searchResults = await agent.api.get<{ id?: string; results?: Array<{ id: string }> }>(
          '/weather/search',
          { q: location },
        );
        const locationId =
          (searchResults as Record<string, unknown>).id ??
          ((searchResults as Record<string, unknown>).results as Array<{ id: string }>)?.[0]?.id;

        if (!locationId) {
          return err(new Error(`No weather location found for: ${location}`));
        }

        // Step 2: fetch the forecast for that location
        const forecast = await agent.api.get('/weather/forecast', { id: String(locationId) });
        return ok(forecast);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Search weather location ───────────────────────────────────────────────

  agent.server.registerTool(
    'search_weather_location',
    {
      description:
        'Search for weather locations by name. Returns matching locations with their IDs. Use get_weather instead for a combined search+forecast in one call — use this only if you need to pick from multiple location matches.',
      inputSchema: {
        query: z.string().min(2).describe('Location search query (e.g. "Yosemite", "Seattle, WA")'),
      },
    },
    async ({ query }) => {
      try {
        const data = await agent.api.get('/weather/search', { q: query });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Season suggestion ─────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_season_suggestions',
    {
      description:
        'Get AI-powered suggestions for the best seasons to visit a destination and recommended activities per season. Useful for trip planning.',
      inputSchema: {
        destination: z
          .string()
          .min(2)
          .describe(
            'Destination to get season suggestions for (e.g. "Patagonia", "Zion National Park")',
          ),
      },
    },
    async ({ destination }) => {
      try {
        const data = await agent.api.get('/season-suggestions', { destination });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );
}
