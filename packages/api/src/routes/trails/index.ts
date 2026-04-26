import { createOsmDb } from '@packrat/api/db';
import { stitchRouteGeometry } from '@packrat/api/services/trails';
import { sql } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const OsmMemberSchema = z.object({
  type: z.string(),
  ref: z.number(),
  role: z.string(),
});

const RouteBaseRowSchema = z.object({
  osm_id: z.string(),
  name: z.string().nullable(),
  sport: z.string().nullable(),
  network: z.string().nullable(),
  distance: z.string().nullable(),
  difficulty: z.string().nullable(),
  description: z.string().nullable(),
});

const RouteSearchRowSchema = RouteBaseRowSchema.extend({
  bbox: z.string().nullable(),
});

const RouteDetailRowSchema = RouteBaseRowSchema.extend({
  members: z.array(OsmMemberSchema).nullable(),
  geojson: z.string().nullable(),
});

// ── Routes ─────────────────────────────────────────────────────────────────

export const trailsRoutes = new Elysia({ prefix: '/trails' })

  /**
   * GET /api/trails/search
   *
   * Fast text + spatial search over osm_routes.
   * Supports optional sport filter (hiking, cycling, skiing, …).
   * Returns lightweight results (no geometry) suitable for a search list.
   */
  .get(
    '/search',
    async ({ query }) => {
      const { q, lat, lon, radius = 50, sport, limit = 50, offset = 0 } = query;

      if (!q && (lat === undefined || lon === undefined)) {
        return status(400, { error: 'Provide q (text) and/or lat+lon for spatial search' });
      }

      const db = createOsmDb();

      try {
        const conditions: ReturnType<typeof sql>[] = [];

        if (q) conditions.push(sql`name ILIKE ${`%${q}%`}`);

        if (sport) conditions.push(sql`sport = ${sport}`);

        if (lat !== undefined && lon !== undefined) {
          conditions.push(sql`
            ST_DWithin(
              geometry::geography,
              ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
              ${radius * 1000}
            )
          `);
        }

        const whereClause =
          conditions.length > 0
            ? sql`WHERE ${conditions.reduce((acc, c) => sql`${acc} AND ${c}`)}`
            : sql``;

        const result = await db.execute(sql`
          SELECT
            osm_id::text,
            name,
            sport,
            network,
            distance,
            difficulty,
            description,
            ST_AsGeoJSON(ST_Envelope(geometry)) AS bbox
          FROM osm_routes
          ${whereClause}
          ORDER BY
            CASE WHEN name IS NOT NULL THEN 0 ELSE 1 END,
            name
          LIMIT ${limit} OFFSET ${offset}
        `);

        const rows = z.array(RouteSearchRowSchema).parse(result.rows);

        return rows.map((row) => ({
          osmId: row.osm_id,
          name: row.name,
          sport: row.sport,
          network: row.network,
          distance: row.distance,
          difficulty: row.difficulty,
          description: row.description,
          bbox: row.bbox ? JSON.parse(row.bbox) : null,
        }));
      } catch (error) {
        console.error('Trail search error:', error);
        return status(500, { error: 'Trail search failed' });
      }
    },
    {
      query: z.object({
        q: z.string().optional(),
        lat: z.coerce.number().min(-90).max(90).optional(),
        lon: z.coerce.number().min(-180).max(180).optional(),
        radius: z.coerce.number().positive().max(500).optional(),
        sport: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      }),
      detail: {
        tags: ['Trails'],
        summary: 'Search outdoor routes by text, location, and/or sport',
      },
    },
  )

  /**
   * GET /api/trails/:osmId/geometry
   *
   * Returns the full GeoJSON geometry for a route.
   * Uses stored geometry when available; falls back to runtime ST_LineMerge
   * stitching from member ways otherwise.
   */
  .get(
    '/:osmId/geometry',
    async ({ params }) => {
      let osmId: bigint;
      try {
        osmId = BigInt(params.osmId);
      } catch {
        return status(400, { error: 'osmId must be a positive integer' });
      }

      const db = createOsmDb();

      try {
        const result = await db.execute(sql`
          SELECT
            osm_id::text,
            name,
            sport,
            network,
            distance,
            difficulty,
            description,
            CASE WHEN geometry IS NULL THEN members ELSE NULL END AS members,
            ST_AsGeoJSON(geometry) AS geojson
          FROM osm_routes
          WHERE osm_id = ${osmId}
        `);

        const row = RouteDetailRowSchema.nullable().parse(result.rows?.[0] ?? null);
        if (!row) return status(404, { error: 'Trail not found' });

        let geometry: unknown = null;

        if (row.geojson) {
          geometry = JSON.parse(row.geojson);
        } else if (row.members && row.members.length > 0) {
          geometry = await stitchRouteGeometry(db, row.members);
        }

        return {
          osmId: row.osm_id,
          name: row.name,
          sport: row.sport,
          network: row.network,
          distance: row.distance,
          difficulty: row.difficulty,
          description: row.description,
          geometry,
        };
      } catch (error) {
        console.error('Trail geometry error:', error);
        return status(500, { error: 'Failed to fetch trail geometry' });
      }
    },
    {
      params: z.object({ osmId: z.string().regex(/^\d+$/, 'osmId must be a positive integer') }),
      detail: {
        tags: ['Trails'],
        summary: 'Get full GeoJSON geometry for a route (stitches from OSM ways if needed)',
      },
    },
  )

  /**
   * GET /api/trails/:osmId
   *
   * Lightweight route metadata without geometry (for detail screens).
   */
  .get(
    '/:osmId',
    async ({ params }) => {
      let osmId: bigint;
      try {
        osmId = BigInt(params.osmId);
      } catch {
        return status(400, { error: 'osmId must be a positive integer' });
      }

      const db = createOsmDb();

      try {
        const result = await db.execute(sql`
          SELECT
            osm_id::text,
            name,
            sport,
            network,
            distance,
            difficulty,
            description,
            ST_AsGeoJSON(ST_Envelope(geometry)) AS bbox
          FROM osm_routes
          WHERE osm_id = ${osmId}
        `);

        const row = RouteSearchRowSchema.nullable().parse(result.rows?.[0] ?? null);
        if (!row) return status(404, { error: 'Trail not found' });

        return {
          osmId: row.osm_id,
          name: row.name,
          sport: row.sport,
          network: row.network,
          distance: row.distance,
          difficulty: row.difficulty,
          description: row.description,
          bbox: row.bbox ? JSON.parse(row.bbox) : null,
        };
      } catch (error) {
        console.error('Trail fetch error:', error);
        return status(500, { error: 'Failed to fetch trail' });
      }
    },
    {
      params: z.object({ osmId: z.string().regex(/^\d+$/, 'osmId must be a positive integer') }),
      detail: {
        tags: ['Trails'],
        summary: 'Get route metadata by OSM relation ID',
      },
    },
  )

  /**
   * POST /api/trails/alltrails-preview
   *
   * Fetches an AllTrails URL server-side and extracts OpenGraph metadata.
   */
  .post(
    '/alltrails-preview',
    async ({ body }) => {
      const { url } = body;

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return status(400, { error: 'Invalid URL' });
      }

      const { hostname } = parsed;
      if (hostname !== 'alltrails.com' && !hostname.endsWith('.alltrails.com')) {
        return status(400, { error: 'Only alltrails.com URLs are supported' });
      }

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PackRat/1.0; +https://packrat.world)',
            Accept: 'text/html',
          },
          signal: AbortSignal.timeout(8000),
        });

        const finalHostname = new URL(response.url).hostname;
        if (finalHostname !== 'alltrails.com' && !finalHostname.endsWith('.alltrails.com')) {
          return status(400, { error: 'Redirect target is not alltrails.com' });
        }

        if (!response.ok) {
          return status(502, { error: `AllTrails returned ${response.status}` });
        }

        const html = await response.text();

        const extract = (property: string): string | null => {
          const match =
            html.match(
              new RegExp(
                `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
                'i',
              ),
            ) ??
            html.match(
              new RegExp(
                `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
                'i',
              ),
            );
          return match?.[1] ?? null;
        };

        const title = extract('og:title');
        const description = extract('og:description');
        const image = extract('og:image');

        if (!title) {
          return status(422, { error: 'Could not extract trail metadata from page' });
        }

        return { title, description, image, url };
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          return status(504, { error: 'AllTrails request timed out' });
        }
        console.error('AllTrails preview error:', error);
        return status(502, { error: 'Failed to fetch AllTrails page' });
      }
    },
    {
      body: z.object({ url: z.string().url() }),
      detail: {
        tags: ['Trails'],
        summary: 'Fetch trail card metadata from an AllTrails URL via OG tags',
      },
    },
  );
