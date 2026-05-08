import { createDb, createOsmDb } from '@packrat/api/db';
import { trailConditionReports, users } from '@packrat/api/db/schema';
import {
  AdminErrorResponses,
  SuccessSchema,
  TrailConditionsListSchema,
  TrailGeometrySchema,
  TrailSearchItemSchema,
  TrailSearchResultSchema,
} from '@packrat/api/schemas/admin';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const RouteSearchRowSchema = z.object({
  osm_id: z.string(),
  name: z.string().nullable(),
  sport: z.string().nullable(),
  network: z.string().nullable(),
  distance: z.string().nullable(),
  difficulty: z.string().nullable(),
  description: z.string().nullable(),
  bbox: z.string().nullable(),
});

export const adminTrailsRoutes = new Elysia({ prefix: '/trails' })

  /**
   * GET /admin/trails/search
   *
   * Text + sport search over OSM routes (admin auth, no user JWT required).
   */
  .get(
    '/search',
    async ({ query }) => {
      const { q, sport, limit = 50, offset = 0 } = query;

      if (!q) {
        return status(400, { error: 'Provide q (trail name to search)' });
      }

      try {
        const db = createOsmDb();
        const conditions: ReturnType<typeof sql>[] = [sql`name ILIKE ${`%${q}%`}`];

        if (sport) conditions.push(sql`sport = ${sport}`);

        const whereClause = sql`WHERE ${conditions.reduce((acc, c) => sql`${acc} AND ${c}`)}`;

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
          LIMIT ${limit + 1} OFFSET ${offset}
        `);

        const rows = z.array(RouteSearchRowSchema).parse(result.rows);
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
            bbox: row.bbox ? JSON.parse(row.bbox) : null,
          })),
          hasMore,
          offset,
          limit,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not configured')) {
          return status(503, { error: 'Trail features are not enabled on this server' });
        }
        console.error('Admin trail search error:', error);
        return status(500, { error: 'Trail search failed' });
      }
    },
    {
      query: z.object({
        q: z.string().min(1),
        sport: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      }),
      response: { 200: TrailSearchResultSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Search OSM trails by name' },
    },
  )

  /**
   * GET /admin/trails/:osmId/geometry
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

        const DetailRowSchema = z.object({
          osm_id: z.string(),
          name: z.string().nullable(),
          sport: z.string().nullable(),
          network: z.string().nullable(),
          distance: z.string().nullable(),
          difficulty: z.string().nullable(),
          description: z.string().nullable(),
          members: z
            .array(z.object({ type: z.string(), ref: z.coerce.bigint(), role: z.string() }))
            .nullable(),
          geojson: z.string().nullable(),
        });

        const row = DetailRowSchema.nullable().parse(result.rows?.[0] ?? null);
        if (!row) return status(404, { error: 'Trail not found' });

        let geometry: unknown = null;
        if (row.geojson) {
          geometry = JSON.parse(row.geojson);
        } else if (row.members && row.members.length > 0) {
          const { stitchRouteGeometry } = await import('@packrat/api/services/trails');
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
        if (error instanceof Error && error.message.includes('not configured')) {
          return status(503, { error: 'Trail features are not enabled on this server' });
        }
        console.error('Admin trail geometry error:', error);
        return status(500, { error: 'Failed to fetch trail geometry' });
      }
    },
    {
      params: z.object({ osmId: z.string().regex(/^\d+$/) }),
      response: { 200: TrailGeometrySchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Get full GeoJSON geometry for an OSM trail' },
    },
  )

  /**
   * GET /admin/trails/:osmId
   * Trail metadata without geometry.
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
        if (error instanceof Error && error.message.includes('not configured')) {
          return status(503, { error: 'Trail features are not enabled on this server' });
        }
        console.error('Admin trail fetch error:', error);
        return status(500, { error: 'Failed to fetch trail' });
      }
    },
    {
      params: z.object({ osmId: z.string().regex(/^\d+$/) }),
      response: { 200: TrailSearchItemSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Get OSM trail metadata by ID' },
    },
  )

  /**
   * GET /admin/trails/conditions
   * All trail condition reports, newest first, with pagination.
   */
  .get(
    '/conditions',
    async ({ query }) => {
      const db = createDb();
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const search = query.q;
      const includeDeleted = query.includeDeleted === 'true';

      try {
        const deletedFilter = includeDeleted ? undefined : eq(trailConditionReports.deleted, false);
        const searchFilter = search
          ? or(
              ilike(trailConditionReports.trailName, `%${search}%`),
              ilike(trailConditionReports.trailRegion, `%${search}%`),
            )
          : undefined;
        const whereClause =
          deletedFilter && searchFilter
            ? and(deletedFilter, searchFilter)
            : (deletedFilter ?? searchFilter);

        const [reports, [totalRow]] = await Promise.all([
          db
            .select({
              id: trailConditionReports.id,
              trailName: trailConditionReports.trailName,
              trailRegion: trailConditionReports.trailRegion,
              surface: trailConditionReports.surface,
              overallCondition: trailConditionReports.overallCondition,
              hazards: trailConditionReports.hazards,
              waterCrossings: trailConditionReports.waterCrossings,
              notes: trailConditionReports.notes,
              deleted: trailConditionReports.deleted,
              createdAt: trailConditionReports.createdAt,
              userId: trailConditionReports.userId,
              userEmail: users.email,
            })
            .from(trailConditionReports)
            .leftJoin(users, eq(trailConditionReports.userId, users.id))
            .where(whereClause)
            .orderBy(desc(trailConditionReports.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ count: count() }).from(trailConditionReports).where(whereClause),
        ]);

        return {
          data: reports.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          })),
          total: totalRow?.count ?? 0,
          limit,
          offset,
        };
      } catch (error) {
        console.error('Admin trail conditions error:', error);
        return status(500, { error: 'Failed to fetch trail conditions' });
      }
    },
    {
      query: z.object({
        q: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional().default(50),
        offset: z.coerce.number().int().min(0).optional().default(0),
        includeDeleted: z.string().optional(),
      }),
      response: { 200: TrailConditionsListSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'List all trail condition reports' },
    },
  )

  /**
   * DELETE /admin/trails/conditions/:reportId
   * Soft-delete a trail condition report.
   */
  .delete(
    '/conditions/:reportId',
    async ({ params }) => {
      const db = createDb();
      try {
        const updated = await db
          .update(trailConditionReports)
          .set({ deleted: true })
          .where(
            and(
              eq(trailConditionReports.id, params.reportId),
              eq(trailConditionReports.deleted, false),
            ),
          )
          .returning();
        if (!updated.length) return status(404, { error: 'Report not found' });
        return { success: true as const };
      } catch (error) {
        console.error('Admin trail condition delete error:', error);
        return status(500, { error: 'Failed to delete report' });
      }
    },
    {
      params: z.object({ reportId: z.string() }),
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Soft-delete a trail condition report' },
    },
  );
