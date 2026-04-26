import { queryOverpass, TrailQueryBuilder, toTrailDetail, toTrailSummary } from '@packrat/overpass';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const OsmSportSchema = z.enum(['hiking', 'cycling', 'skiing', 'running', 'horse_riding']);

function isOverpassTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('504') || msg.toLowerCase().includes('timeout');
}

export const trailsRoutes = new Elysia({ prefix: '/trails' })
  .get(
    '/search',
    async ({ query }) => {
      const { q, lat, lon, radius, sport, limit, offset } = query;

      if (!q && (lat === undefined || lon === undefined)) {
        return status(400, {
          error: 'Provide either q (text search) or lat + lon (spatial search)',
        });
      }

      const radiusM = Math.min((radius ?? 50) * 1000, 500_000);

      const builder = new TrailQueryBuilder().timeout(25);

      if (sport) builder.sport(sport);
      if (q) builder.name(q);
      if (lat !== undefined && lon !== undefined) builder.around(lat, lon, radiusM);

      const ql = builder.build();

      try {
        const response = await queryOverpass(ql);
        const trails = response.elements.map(toTrailSummary);
        const off = offset ?? 0;
        const lim = limit ?? 50;
        return trails.slice(off, off + lim);
      } catch (err) {
        if (isOverpassTimeout(err)) {
          return status(504, { error: 'Overpass query timed out' });
        }
        console.error('Overpass search error:', err);
        return status(502, { error: 'Overpass API error' });
      }
    },
    {
      query: z.object({
        q: z.string().optional(),
        lat: z.coerce.number().optional(),
        lon: z.coerce.number().optional(),
        radius: z.coerce.number().min(0).max(500).optional(),
        sport: OsmSportSchema.optional(),
        limit: z.coerce.number().int().min(1).max(200).optional().default(50),
        offset: z.coerce.number().int().min(0).optional().default(0),
      }),
      detail: {
        tags: ['Trails'],
        summary: 'Search trails via Overpass',
        description:
          'Search for OSM hiking/cycling/skiing routes by name and/or location. ' +
          'Requires q (text) or lat+lon (spatial), or both.',
      },
    },
  )
  .get(
    '/:osmId',
    async ({ params }) => {
      const osmId = Number(params.osmId);
      if (!Number.isInteger(osmId) || osmId <= 0) {
        return status(400, { error: 'osmId must be a positive integer' });
      }

      const ql = new TrailQueryBuilder().id(osmId).build();

      try {
        const response = await queryOverpass(ql);
        if (response.elements.length === 0) {
          return status(404, { error: `Trail ${osmId} not found` });
        }
        return toTrailSummary(response.elements[0]);
      } catch (err) {
        if (isOverpassTimeout(err)) {
          return status(504, { error: 'Overpass query timed out' });
        }
        console.error('Overpass trail fetch error:', err);
        return status(502, { error: 'Overpass API error' });
      }
    },
    {
      params: z.object({ osmId: z.string() }),
      detail: {
        tags: ['Trails'],
        summary: 'Get trail metadata',
        description: 'Fetch a single OSM route relation by ID (no geometry).',
      },
    },
  )
  .get(
    '/:osmId/geometry',
    async ({ params }) => {
      const osmId = Number(params.osmId);
      if (!Number.isInteger(osmId) || osmId <= 0) {
        return status(400, { error: 'osmId must be a positive integer' });
      }

      const ql = new TrailQueryBuilder().id(osmId).build();

      try {
        const response = await queryOverpass(ql);
        if (response.elements.length === 0) {
          return status(404, { error: `Trail ${osmId} not found` });
        }
        return toTrailDetail(response.elements[0]);
      } catch (err) {
        if (isOverpassTimeout(err)) {
          return status(504, { error: 'Overpass query timed out' });
        }
        console.error('Overpass trail geometry error:', err);
        return status(502, { error: 'Overpass API error' });
      }
    },
    {
      params: z.object({ osmId: z.string() }),
      detail: {
        tags: ['Trails'],
        summary: 'Get trail geometry',
        description:
          'Fetch a single OSM route relation by ID including GeoJSON geometry assembled from member ways.',
      },
    },
  );
