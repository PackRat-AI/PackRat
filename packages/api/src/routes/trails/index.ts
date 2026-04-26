import { createDb } from '@packrat/api/db';
import { sql } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

// ── Types ──────────────────────────────────────────────────────────────────

interface OsmMember {
  type: string;
  ref: number;
  role: string;
}

interface TrailSearchResult {
  osm_id: string;
  name: string | null;
  network: string | null;
  distance: string | null;
  difficulty: string | null;
  description: string | null;
  bbox: unknown;
}

interface TrailRelation {
  osm_id: string;
  name: string | null;
  network: string | null;
  distance: string | null;
  difficulty: string | null;
  description: string | null;
  members: OsmMember[] | null;
  geometry: unknown;
  cached_at: Date | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Stitch member ways into a merged linestring using PostGIS.
 *
 * Collects all hiking_ways geometries referenced by this relation's members
 * then runs ST_LineMerge to produce a continuous (or near-continuous) line.
 * Falls back gracefully when ways are missing or geometry is degenerate.
 */
async function stitchTrailGeometry(
  db: ReturnType<typeof createDb>,
  members: OsmMember[],
): Promise<unknown> {
  const wayRefs = members.filter((m) => m.type === 'w').map((m) => m.ref);

  if (wayRefs.length === 0) return null;

  const result = await db.execute(sql`
    SELECT ST_AsGeoJSON(
      ST_LineMerge(
        ST_Collect(geometry ORDER BY ordinality)
      )
    ) AS geojson
    FROM hiking_ways
    JOIN unnest(
      ARRAY[${sql.raw(wayRefs.join(','))}]::bigint[]
    ) WITH ORDINALITY AS t(osm_id, ordinality)
      USING (osm_id)
    WHERE geometry IS NOT NULL
  `);

  const row = result.rows?.[0] as { geojson: string } | undefined;
  if (!row?.geojson) return null;

  try {
    return JSON.parse(row.geojson);
  } catch {
    return null;
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

export const trailsRoutes = new Elysia({ prefix: '/trails' })

  /**
   * GET /api/trails/search
   *
   * Fast text + spatial search over hiking_relations.
   * Returns lightweight results (no geometry) suitable for a search list.
   */
  .get(
    '/search',
    async ({ query }) => {
      const { q, lat, lon, radius = 50 } = query;

      if (!q && (lat === undefined || lon === undefined)) {
        return status(400, { error: 'Provide q (text) and/or lat+lon for spatial search' });
      }

      const db = createDb();

      try {
        // Build query dynamically based on which filters are present
        const conditions: ReturnType<typeof sql>[] = [];

        if (q) {
          conditions.push(sql`name ILIKE ${`%${q}%`}`);
        }

        if (lat !== undefined && lon !== undefined) {
          // ST_DWithin with geography cast for accurate km-based radius
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
            network,
            distance,
            difficulty,
            description,
            ST_AsGeoJSON(ST_Envelope(geometry)) AS bbox
          FROM hiking_relations
          ${whereClause}
          ORDER BY
            CASE WHEN name IS NOT NULL THEN 0 ELSE 1 END,
            name
          LIMIT 50
        `);

        return (result.rows as unknown as TrailSearchResult[]).map((row) => ({
          osmId: row.osm_id,
          name: row.name,
          network: row.network,
          distance: row.distance,
          difficulty: row.difficulty,
          description: row.description,
          bbox: row.bbox ? JSON.parse(row.bbox as string) : null,
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
      }),
      detail: {
        tags: ['Trails'],
        summary: 'Search hiking trails by text and/or location',
      },
    },
  )

  /**
   * GET /api/trails/:osmId/geometry
   *
   * Returns the full GeoJSON geometry for a trail relation.
   * Uses the pre-built geometry from osm2pgsql when available; falls back to
   * runtime ST_LineMerge stitching from member ways otherwise.
   *
   * Writes the stitched result back to hiking_relations.geometry so subsequent
   * requests are fast (cached_at tracks when this happened).
   */
  .get(
    '/:osmId/geometry',
    async ({ params }) => {
      const osmId = BigInt(params.osmId);
      const db = createDb();

      try {
        const result = await db.execute(sql`
          SELECT
            osm_id::text,
            name,
            network,
            distance,
            difficulty,
            description,
            members,
            ST_AsGeoJSON(geometry) AS geojson,
            cached_at
          FROM hiking_relations
          WHERE osm_id = ${osmId}
        `);

        const row = result.rows?.[0] as (TrailRelation & { geojson: string | null }) | undefined;

        if (!row) return status(404, { error: 'Trail not found' });

        let geometry: unknown = null;

        if (row.geojson) {
          // osm2pgsql already built the geometry — use it directly
          geometry = JSON.parse(row.geojson);
        } else if (row.members && Array.isArray(row.members) && row.members.length > 0) {
          // Stitch from member ways at runtime
          geometry = await stitchTrailGeometry(db, row.members);

          // Cache the stitched result back so we don't repeat the work
          if (geometry) {
            await db.execute(sql`
              UPDATE hiking_relations
              SET
                geometry = ST_GeomFromGeoJSON(${JSON.stringify(geometry)}),
                cached_at = NOW()
              WHERE osm_id = ${osmId}
            `);
          }
        }

        return {
          osmId: row.osm_id,
          name: row.name,
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
        summary: 'Get full GeoJSON geometry for a trail (stitches from OSM ways if needed)',
      },
    },
  )

  /**
   * GET /api/trails/:osmId
   *
   * Lightweight trail metadata without geometry (for detail screens).
   */
  .get(
    '/:osmId',
    async ({ params }) => {
      const osmId = BigInt(params.osmId);
      const db = createDb();

      try {
        const result = await db.execute(sql`
          SELECT
            osm_id::text,
            name,
            network,
            distance,
            difficulty,
            description,
            ST_AsGeoJSON(ST_Envelope(geometry)) AS bbox
          FROM hiking_relations
          WHERE osm_id = ${osmId}
        `);

        const row = result.rows?.[0] as
          | (TrailSearchResult & { geojson: string | null })
          | undefined;
        if (!row) return status(404, { error: 'Trail not found' });

        return {
          osmId: row.osm_id,
          name: row.name,
          network: row.network,
          distance: row.distance,
          difficulty: row.difficulty,
          description: row.description,
          bbox: row.bbox ? JSON.parse(row.bbox as string) : null,
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
        summary: 'Get trail metadata by OSM relation ID',
      },
    },
  )

  /**
   * POST /api/trails/alltrails-preview
   *
   * Fetches an AllTrails URL server-side and extracts OpenGraph metadata.
   * Returns a trail card (title, description, image) without requiring
   * any AllTrails account or API key.
   *
   * AllTrails pages are SSR, so OG tags are present in the raw HTML.
   * Single on-demand fetches triggered by user paste are low-risk.
   */
  .post(
    '/alltrails-preview',
    async ({ body }) => {
      const { url } = body;

      // Only allow alltrails.com URLs to prevent SSRF
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return status(400, { error: 'Invalid URL' });
      }

      if (!parsed.hostname.endsWith('alltrails.com')) {
        return status(400, { error: 'Only alltrails.com URLs are supported' });
      }

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PackRat/1.0; +https://packrat.world)',
            Accept: 'text/html',
          },
          // Cloudflare Workers fetch has no keepalive issues
          signal: AbortSignal.timeout(8000),
        });

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
