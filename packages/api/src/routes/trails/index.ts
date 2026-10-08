import { createOsmDb } from '@packrat/api/db';
import { firstQueryRow, queryRows } from '@packrat/api/db/queryRows';
import { authPlugin } from '@packrat/api/middleware/auth';
import { getTrail, matchRoute, searchTrails } from '@packrat/api/services/trailRegistry';
import { stitchRouteGeometry } from '@packrat/api/services/trails';
import { captureApiException } from '@packrat/api/utils/sentry';
import { ErrorResponseSchema } from '@packrat/schemas/shared';
import {
  RouteDetailRowSchema,
  RouteSearchRowSchema,
  TrailDetailSchema,
  TrailMatchBodySchema,
  TrailMatchSchema,
  TrailSearchQuerySchema,
  TrailSummarySchema,
} from '@packrat/schemas/trails';
import { safeJsonParse } from '@packrat/utils';
import { sql } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

/** 503 when this server has no trail database; anything else is reported. */
function registryError({
  error,
  operation,
  extra,
}: {
  error: unknown;
  operation: string;
  extra: Record<string, unknown>;
}) {
  if (error instanceof Error && error.message.includes('not configured')) {
    return status(503, { error: 'Trail features are not enabled on this server' });
  }
  captureApiException({
    error,
    operation,
    tags: { feature: 'trails' },
    extra: { ...extra, httpStatus: 500, errorCode: 'TRAIL_REGISTRY_ERROR' },
  });
  return status(500, { error: 'Trail lookup failed' });
}

// ── Routes ─────────────────────────────────────────────────────────────────

export const trailsRoutes = new Elysia({ prefix: '/trails' })
  .model({
    'trails.RouteDetailRow': RouteDetailRowSchema,
    'trails.RouteSearchRow': RouteSearchRowSchema,
  })
  .use(authPlugin)

  // ── Trail registry (PackRat's own trails table, stable ids) ──────────────

  /** GET /api/trails/registry/search — trails by name and/or near a point. */
  .get(
    '/registry/search',
    async ({ query }) => {
      try {
        return await searchTrails(createOsmDb(), query);
      } catch (error) {
        return registryError({ error, operation: 'trailRegistry.search', extra: { ...query } });
      }
    },
    {
      query: TrailSearchQuerySchema,
      response: {
        200: z.array(TrailSummarySchema),
        500: ErrorResponseSchema,
        503: ErrorResponseSchema,
      },
      isAuthenticated: true,
      detail: {
        tags: ['Trails'],
        summary: 'Search the trail registry by name and/or location',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  /** POST /api/trails/registry/match — trails a recorded route walked along. */
  .post(
    '/registry/match',
    async ({ body }) => {
      try {
        return await matchRoute(createOsmDb(), body.route);
      } catch (error) {
        return registryError({
          error,
          operation: 'trailRegistry.match',
          extra: { routeLength: body.route.length },
        });
      }
    },
    {
      body: TrailMatchBodySchema,
      response: {
        200: z.array(TrailMatchSchema),
        500: ErrorResponseSchema,
        503: ErrorResponseSchema,
      },
      isAuthenticated: true,
      detail: {
        tags: ['Trails'],
        summary: 'Trails a route (encoded polyline) passes along, with coverage',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  /** GET /api/trails/registry/:id — one trail with its geometry. */
  .get(
    '/registry/:id',
    async ({ params }) => {
      try {
        const trail = await getTrail(createOsmDb(), params.id);
        if (!trail) return status(404, { error: 'Trail not found' });
        return trail;
      } catch (error) {
        return registryError({ error, operation: 'trailRegistry.get', extra: { id: params.id } });
      }
    },
    {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: TrailDetailSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
        503: ErrorResponseSchema,
      },
      isAuthenticated: true,
      detail: {
        tags: ['Trails'],
        summary: 'Get a registry trail with its geometry as encoded polylines',
        security: [{ bearerAuth: [] }],
      },
    },
  )

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

      try {
        const db = createOsmDb();
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

        const result = await db.tag('trails.search').execute(sql`
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
          LIMIT ${limit + 1} OFFSET ${offset}
        `);

        const rows = z.array(RouteSearchRowSchema).parse(queryRows(result));
        const hasMore = rows.length > limit;
        const page = rows.slice(0, limit);

        return {
          trails: page.map((row) => ({
            osmId: row.osm_id,
            name: row.name,
            sport: row.sport,
            network: row.network,
            distance: row.distance,
            difficulty: row.difficulty,
            description: row.description,
            bbox: row.bbox ? safeJsonParse(row.bbox, { strict: true }) : null,
          })),
          hasMore,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not configured')) {
          return status(503, { error: 'Trail features are not enabled on this server' });
        }
        captureApiException({
          error: error,
          operation: 'trails.search',
          tags: { feature: 'trails' },
          extra: { q, lat, lon, radius, sport, httpStatus: 500, errorCode: 'TRAILS_SEARCH_ERROR' },
        });
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
      isAuthenticated: true,
      detail: {
        tags: ['Trails'],
        summary: 'Search outdoor routes by text, location, and/or sport',
        security: [{ bearerAuth: [] }],
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

      try {
        const db = createOsmDb();
        const result = await db.tag('trails.getGeometry').execute(sql`
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

        const row = RouteDetailRowSchema.nullable().parse(firstQueryRow(result) ?? null);
        if (!row) return status(404, { error: 'Trail not found' });

        let geometry: unknown = null;

        if (row.geojson) {
          geometry = safeJsonParse(row.geojson, { strict: true });
        } else if (row.members && row.members.length > 0) {
          geometry = await stitchRouteGeometry({ db, members: row.members });
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
        if (error instanceof Error && error.message.includes('not configured')) {
          return status(503, { error: 'Trail features are not enabled on this server' });
        }
        captureApiException({
          error: error,
          operation: 'trails.geometry',
          tags: { feature: 'trails' },
          extra: { osmId: String(osmId), httpStatus: 500, errorCode: 'TRAILS_GEOMETRY_ERROR' },
        });
        return status(500, { error: 'Failed to fetch trail geometry' });
      }
    },
    {
      params: z.object({ osmId: z.string().regex(/^\d+$/, 'osmId must be a positive integer') }),
      isAuthenticated: true,
      detail: {
        tags: ['Trails'],
        summary: 'Get full GeoJSON geometry for a route (stitches from OSM ways if needed)',
        security: [{ bearerAuth: [] }],
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

      try {
        const db = createOsmDb();
        const result = await db.tag('trails.getById').execute(sql`
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

        const row = RouteSearchRowSchema.nullable().parse(firstQueryRow(result) ?? null);
        if (!row) return status(404, { error: 'Trail not found' });

        return {
          osmId: row.osm_id,
          name: row.name,
          sport: row.sport,
          network: row.network,
          distance: row.distance,
          difficulty: row.difficulty,
          description: row.description,
          bbox: row.bbox ? safeJsonParse(row.bbox, { strict: true }) : null,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not configured')) {
          return status(503, { error: 'Trail features are not enabled on this server' });
        }
        captureApiException({
          error: error,
          operation: 'trails.getById',
          tags: { feature: 'trails' },
          extra: { osmId: String(osmId), httpStatus: 500, errorCode: 'TRAILS_GET_BY_ID_ERROR' },
        });
        return status(500, { error: 'Failed to fetch trail' });
      }
    },
    {
      params: z.object({ osmId: z.string().regex(/^\d+$/, 'osmId must be a positive integer') }),
      isAuthenticated: true,
      detail: {
        tags: ['Trails'],
        summary: 'Get route metadata by OSM relation ID',
        security: [{ bearerAuth: [] }],
      },
    },
  );
