import { z } from 'zod';
import { err, ok } from '../client';
import type { AgentContext } from '../types';

export function registerTrailTools(agent: AgentContext): void {
  // ── Search trails ─────────────────────────────────────────────────────────

  agent.server.registerTool(
    'search_trails',
    {
      description:
        'Search outdoor trails and routes from OpenStreetMap. Filter by name, sport type, and/or proximity to a location. Returns lightweight metadata (no geometry) suitable for a search list.',
      inputSchema: {
        q: z
          .string()
          .optional()
          .describe('Text to search in route names (e.g. "John Muir Trail", "Pacific Crest")'),
        lat: z
          .number()
          .min(-90)
          .max(90)
          .optional()
          .describe('Latitude for spatial search (requires lon)'),
        lon: z
          .number()
          .min(-180)
          .max(180)
          .optional()
          .describe('Longitude for spatial search (requires lat)'),
        radius: z
          .number()
          .positive()
          .max(500)
          .optional()
          .describe('Search radius in kilometres (default 50, max 500)'),
        sport: z
          .string()
          .optional()
          .describe('Filter by sport type: hiking, cycling, skiing, or other OSM sport values'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Maximum results to return (default 50)'),
        offset: z.number().int().min(0).optional().describe('Pagination offset (default 0)'),
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

  // ── Get trail metadata ────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_trail',
    {
      description:
        'Get metadata for a specific trail by its OSM relation ID. Returns name, sport, difficulty, distance, and bounding box. Does not include full geometry — use get_trail_geometry for that.',
      inputSchema: {
        osm_id: z
          .string()
          .describe('OSM relation ID of the route (e.g. "12345678"). Get from search_trails.'),
      },
    },
    async ({ osm_id }) => {
      try {
        const data = await agent.api.get(`/trails/${osm_id}`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Get trail geometry ────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_trail_geometry',
    {
      description:
        'Get the full GeoJSON geometry for a trail. Uses pre-built geometry when available; otherwise stitches it from member OSM ways. May be slow for large routes with many segments.',
      inputSchema: {
        osm_id: z
          .string()
          .describe('OSM relation ID of the route (e.g. "12345678"). Get from search_trails.'),
      },
    },
    async ({ osm_id }) => {
      try {
        const data = await agent.api.get(`/trails/${osm_id}/geometry`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── AllTrails preview ─────────────────────────────────────────────────────

  agent.server.registerTool(
    'preview_alltrails_url',
    {
      description:
        'Fetch trail metadata (title, description, image) from an AllTrails URL using OpenGraph tags. Use this to enrich a trip or pack with information from an AllTrails link a user shares.',
      inputSchema: {
        url: z
          .string()
          .url()
          .describe('Full AllTrails URL (must be https://alltrails.com/... or a subdomain)'),
      },
    },
    async ({ url }) => {
      try {
        const data = await agent.api.post('/alltrails/preview', { url });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );
}
