import { z } from 'zod';
import { call } from '../client';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

export function registerTrailTools(agent: AgentContext): void {
  // ── Search trails ─────────────────────────────────────────────────────────

  tool<{
    q?: string;
    lat?: number;
    lon?: number;
    radius?: number;
    sport?: string;
    limit?: number;
    offset?: number;
  }>(
    agent.server,
    'packrat_search_trails',
    {
      title: 'Search Trails',
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
      annotations: {
        title: 'Search Trails',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ q, lat, lon, radius, sport, limit, offset }) =>
      call({
        promise: agent.api.user.trails.search.get({
          query: { q, lat, lon, radius, sport, limit, offset },
        }),
        action: 'search trails',
      }),
  );

  // ── Get trail metadata ────────────────────────────────────────────────────

  tool<{ osm_id: string }>(
    agent.server,
    'packrat_get_trail',
    {
      title: 'Get Trail',
      description:
        'Get metadata for a specific trail by its OSM relation ID. Returns name, sport, difficulty, distance, and bounding box.',
      inputSchema: { osm_id: z.string() },
      annotations: {
        title: 'Get Trail',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ osm_id }) =>
      call({
        promise: agent.api.user.trails({ osmId: osm_id }).get(),
        action: 'get trail',
        resourceHint: `trail ${osm_id}`,
      }),
  );

  // ── Get trail geometry ────────────────────────────────────────────────────

  tool<{ osm_id: string }>(
    agent.server,
    'packrat_get_trail_geometry',
    {
      title: 'Get Trail Geometry',
      description:
        'Get full GeoJSON geometry for a trail. May be slow for large routes with many segments.',
      inputSchema: { osm_id: z.string() },
      annotations: {
        title: 'Get Trail Geometry',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ osm_id }) =>
      call({
        promise: agent.api.user.trails({ osmId: osm_id }).geometry.get(),
        action: 'get trail geometry',
        resourceHint: `trail ${osm_id}`,
      }),
  );
}
