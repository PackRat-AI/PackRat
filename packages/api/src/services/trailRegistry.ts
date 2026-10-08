import {
  SqlRowsResultSchema,
  type TrailDetail,
  type TrailMatch,
  TrailRegistryDetailRowSchema,
  TrailRegistryMatchRowSchema,
  type TrailRegistryRow,
  TrailRegistryRowSchema,
  type TrailSearchQuery,
  type TrailSummary,
} from '@packrat/schemas/trails';
import { type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';

/**
 * The slice of the trail database client these queries use (`createOsmDb()`
 * satisfies it), so tests can pass a fake that records the SQL.
 */
export interface TrailDb {
  tag(label: string): { execute(query: SQL): Promise<unknown> };
}

/** Rows from either driver's result shape (array, or `{ rows }`). */
function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const withRows = SqlRowsResultSchema.safeParse(result);
  return withRows.success ? withRows.data.rows : [];
}

export const TRAIL_SEARCH_LIMIT = 20;
export const TRAIL_SEARCH_RADIUS_KM = 10;
/** A route counts as walking a trail within this many metres of it. */
export const TRAIL_MATCH_BUFFER_METERS = 40;
/** Trails the route only brushes past are left out of a match. */
export const TRAIL_MATCH_MIN_COVERAGE = 0.2;
const TRAIL_MATCH_LIMIT = 20;
/** Degrees of latitude in a kilometre, for the index prefilter box. */
const DEGREES_PER_KM = 1 / 111;

const BBOX_COLUMNS = sql`ST_XMin(t.geom) AS west, ST_YMin(t.geom) AS south, ST_XMax(t.geom) AS east, ST_YMax(t.geom) AS north`;

export function toTrailSummary(row: TrailRegistryRow): TrailSummary {
  return {
    id: row.id,
    name: row.name,
    lengthMeters: Math.round(row.length_m),
    distanceMeters: row.distance_m == null ? null : Math.round(row.distance_m),
    bbox: [row.west, row.south, row.east, row.north],
  };
}

const LIKE_SPECIAL_CHARS: ReadonlySet<string> = new Set(['\\', '%', '_']);

/** `%`, `_` and `\` match literally inside the ILIKE pattern. */
export function likePattern(q: string): string {
  const escaped = Array.from(q, (c) => (LIKE_SPECIAL_CHARS.has(c) ? `\\${c}` : c)).join('');
  return `%${escaped}%`;
}

/**
 * Trails by name, by place, or both. With a point, results stay within the
 * radius and nearer trails rank higher among equal name matches; without
 * one, the whole registry is searched by name.
 */
export async function searchTrails(db: TrailDb, query: TrailSearchQuery): Promise<TrailSummary[]> {
  const { q, lat, lon } = query;
  const limit = query.limit ?? TRAIL_SEARCH_LIMIT;
  const radiusKm = query.radiusKm ?? TRAIL_SEARCH_RADIUS_KM;
  const point =
    lat !== undefined && lon !== undefined
      ? sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`
      : null;

  const conditions: SQL[] = [sql`t.missing_since_release IS NULL`];
  if (q) conditions.push(sql`(t.name ILIKE ${likePattern(q)} OR t.name % ${q})`);
  if (point) {
    // Box prefilter for the GIST index, then the exact distance on the sphere.
    const degrees = radiusKm * DEGREES_PER_KM * 1.5;
    conditions.push(sql`t.geom && ST_Expand(${point}, ${degrees})`);
    conditions.push(sql`ST_DWithin(t.geom::geography, ${point}::geography, ${radiusKm * 1000})`);
  }

  const distance = point ? sql`ST_Distance(t.geom::geography, ${point}::geography)` : sql`NULL`;
  const order: SQL[] = [];
  if (q) {
    order.push(sql`(t.name ILIKE ${likePattern(q).slice(1)}) DESC`);
    order.push(sql`similarity(t.name, ${q}) DESC`);
  }
  order.push(point ? sql`distance_m ASC` : sql`t.length_m DESC`);

  const result = await db.tag('trailRegistry.search').execute(sql`
    SELECT t.id::text AS id, t.name, t.length_m, ${distance} AS distance_m, ${BBOX_COLUMNS}
    FROM trails t
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY ${sql.join(order, sql`, `)}
    LIMIT ${limit}
  `);
  return z.array(TrailRegistryRowSchema).parse(rowsOf(result)).map(toTrailSummary);
}

/** One trail with its geometry, or null when the id is unknown. */
export async function getTrail(db: TrailDb, id: string): Promise<TrailDetail | null> {
  const result = await db.tag('trailRegistry.get').execute(sql`
    SELECT t.id::text AS id, t.name, t.length_m, ${BBOX_COLUMNS},
      ARRAY(
        SELECT ST_AsEncodedPolyline(part.geom, 5)
        FROM ST_Dump(t.geom) AS part
        ORDER BY part.path
      ) AS lines
    FROM trails t
    WHERE t.id = ${id}::uuid
  `);
  const row = TrailRegistryDetailRowSchema.nullable().parse(rowsOf(result)[0] ?? null);
  if (!row) return null;
  const { distanceMeters: _, ...summary } = toTrailSummary(row);
  return { ...summary, lines: row.lines };
}

/**
 * The trails a recorded route walks along, with the share of each trail's
 * length it covers. Trails it only crosses or brushes are dropped.
 */
export async function matchRoute(db: TrailDb, route: string): Promise<TrailMatch[]> {
  const result = await db.tag('trailRegistry.match').execute(sql`
    WITH corridor AS (
      SELECT ST_Buffer(
        ST_LineFromEncodedPolyline(${route}, 5)::geography,
        ${TRAIL_MATCH_BUFFER_METERS}
      )::geometry AS geom
    )
    SELECT * FROM (
      SELECT t.id::text AS id, t.name, t.length_m, ${BBOX_COLUMNS},
        LEAST(1, ST_Length(ST_Intersection(t.geom, c.geom)::geography) / GREATEST(t.length_m, 1)) AS coverage
      FROM trails t, corridor c
      WHERE t.missing_since_release IS NULL
        AND t.geom && c.geom
        AND ST_Intersects(t.geom, c.geom)
    ) matched
    WHERE coverage >= ${TRAIL_MATCH_MIN_COVERAGE}
    ORDER BY coverage DESC, length_m DESC
    LIMIT ${TRAIL_MATCH_LIMIT}
  `);
  return z
    .array(TrailRegistryMatchRowSchema)
    .parse(rowsOf(result))
    .map((row) => {
      const { distanceMeters: _, ...summary } = toTrailSummary(row);
      return { ...summary, coverage: Math.round(row.coverage * 1000) / 1000 };
    });
}
