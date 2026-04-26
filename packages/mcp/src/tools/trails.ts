import { z } from 'zod';
import { err, ok } from '../client';
import type { AgentContext } from '../types';

export function registerTrailTools(agent: AgentContext): void {
  agent.server.registerTool(
    'search_trails',
    {
      description:
        'Search for hiking, cycling, skiing, or other outdoor trails via OpenStreetMap. ' +
        'Filter by name and/or location. Requires either q (text) or lat+lon (spatial search).',
      inputSchema: {
        q: z
          .string()
          .optional()
          .describe('Trail or route name to search for (e.g. "John Muir Trail")'),
        lat: z.number().optional().describe('Latitude of the center point for spatial search'),
        lon: z.number().optional().describe('Longitude of the center point for spatial search'),
        radius: z
          .number()
          .min(0)
          .max(500)
          .optional()
          .describe('Search radius in kilometres (default 50, max 500)'),
        sport: z
          .enum(['hiking', 'cycling', 'skiing', 'running', 'horse_riding'])
          .optional()
          .describe('Filter by sport/activity type'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(50)
          .describe('Maximum results to return (default 50)'),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe('Offset for client-side pagination (default 0)'),
      },
    },
    async ({ q, lat, lon, radius, sport, limit, offset }) => {
      try {
        const data = await agent.api.get('/trails/search', {
          q,
          lat,
          lon,
          radius,
          sport,
          limit,
          offset,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  agent.server.registerTool(
    'get_trail',
    {
      description:
        'Get metadata for a specific trail by its OpenStreetMap relation ID. ' +
        'Returns name, sport, network, distance, difficulty, and bounding box.',
      inputSchema: {
        osmId: z.string().describe('OSM relation ID of the trail (e.g. "1243746")'),
      },
    },
    async ({ osmId }) => {
      try {
        const data = await agent.api.get(`/trails/${osmId}`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  agent.server.registerTool(
    'get_trail_geometry',
    {
      description:
        'Get full GeoJSON geometry for a trail by its OpenStreetMap relation ID. ' +
        'Returns all trail metadata plus a GeoJSON LineString or MultiLineString.',
      inputSchema: {
        osmId: z.string().describe('OSM relation ID of the trail (e.g. "1243746")'),
      },
    },
    async ({ osmId }) => {
      try {
        const data = await agent.api.get(`/trails/${osmId}/geometry`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );
}
