import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerTrailTools(agent: AgentContext): void {
  // ── Search trails ─────────────────────────────────────────────────────────

  agent.server.registerTool(
    'search_trails',
    {
      description:
        'Search outdoor trails and routes from OpenStreetMap. Filter by name, sport type, and/or proximity to a location. Returns { trails, hasMore } — paginate via offset.',
      inputSchema: {
        q: z.string().optional(),
        lat: z.number().min(-90).max(90).optional(),
        lon: z.number().min(-180).max(180).optional(),
        radius: z.number().positive().max(500).optional().describe('Radius in km (default 50)'),
        sport: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ q, lat, lon, radius, sport, limit, offset }) =>
      call(agent.api.user.trails.search.get({ query: { q, lat, lon, radius, sport, limit, offset } }), {
        action: 'search trails',
      }),
  );

  // ── Get trail metadata ────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_trail',
    {
      description:
        'Get metadata for a specific trail by its OSM relation ID. Returns name, sport, difficulty, distance, and bounding box.',
      inputSchema: { osm_id: z.string() },
    },
    async ({ osm_id }) =>
      call(agent.api.user.trails({ osmId: osm_id }).get(), {
        action: 'get trail',
        resourceHint: `trail ${osm_id}`,
      }),
  );

  // ── Get trail geometry ────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_trail_geometry',
    {
      description:
        'Get full GeoJSON geometry for a trail. May be slow for large routes with many segments.',
      inputSchema: { osm_id: z.string() },
    },
    async ({ osm_id }) =>
      call(agent.api.user.trails({ osmId: osm_id }).geometry.get(), {
        action: 'get trail geometry',
        resourceHint: `trail ${osm_id}`,
      }),
  );
}
