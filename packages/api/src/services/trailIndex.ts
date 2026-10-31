import { queryRows, type RawSqlResult } from '@packrat/api/db/queryRows';
import {
  type TrailDetailRow,
  TrailDetailRowSchema,
  type TrailRow,
  TrailRowSchema,
} from '@packrat/schemas/trailConditions';
import { safeJsonParse } from '@packrat/utils';
import { type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';

/** The slice of the trail-db client these queries use (satisfied by `createOsmDb()`). */
export interface TrailDb {
  tag(label: string): { execute(query: SQL): Promise<RawSqlResult<unknown>> };
}

// Trails nearer than this are offered first when the hiker is standing on one.
const NEAREST_RADIUS_M = 25_000;

const LIKE_SPECIALS = /[\\%_]/g;

const trailColumns = sql`
  id::text,
  name,
  length_m,
  ST_Y(ST_PointOnSurface(geom)) AS center_lat,
  ST_X(ST_PointOnSurface(geom)) AS center_lon,
  ST_AsGeoJSON(ST_Envelope(geom)) AS bbox
`;

export interface TrailSummary {
  id: string;
  name: string;
  lengthM: number;
  center: { latitude: number; longitude: number };
  bbox: [number, number, number, number] | null;
  distanceM: number | null;
}

/** GeoJSON Polygon envelope → [west, south, east, north]. */
function envelopeToBbox(geojson: string): TrailSummary['bbox'] {
  const parsed = z
    .object({ coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))) })
    .safeParse(safeJsonParse(geojson));
  const ring = parsed.success ? parsed.data.coordinates[0] : undefined;
  if (!ring || ring.length === 0) return null;
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function toSummary(row: TrailRow): TrailSummary {
  return {
    id: row.id,
    name: row.name,
    lengthM: row.length_m,
    center: { latitude: row.center_lat, longitude: row.center_lon },
    bbox: envelopeToBbox(row.bbox),
    distanceM: row.distance_m === null ? null : Math.round(row.distance_m),
  };
}

/**
 * Trails for the picker. With a query, names that match it; with a location,
 * nearest first. With both, matching names nearest first, so the trail the
 * hiker is standing on wins over a same-named one across the state.
 */
export async function searchTrails({
  db,
  q,
  lat,
  lon,
  limit,
}: {
  db: TrailDb;
  q?: string;
  lat?: number;
  lon?: number;
  limit: number;
}): Promise<TrailSummary[]> {
  const term = q?.trim();
  const point =
    lat !== undefined && lon !== undefined
      ? sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`
      : null;

  const distance = point ? sql`ST_Distance(geom::geography, ${point}::geography)` : sql`NULL`;

  const where = term ? sql`WHERE name ILIKE ${`%${term.replace(LIKE_SPECIALS, '\\$&')}%`}` : sql``;

  // KNN (`<->`) uses the GiST index; similarity ranks text-only searches.
  const orderBy = point
    ? sql`ORDER BY geom <-> ${point}`
    : sql`ORDER BY similarity(name, ${term ?? ''}) DESC, length_m DESC`;

  // A location with no query lists only what's around it. The radius is
  // applied after the indexed KNN limit; a geography ST_DWithin in the WHERE
  // can't use the geometry index and scans the table.
  const nearbyOnly = !term && point;
  const found = sql`
    SELECT ${trailColumns}, ${distance} AS distance_m
    FROM trails
    ${where}
    ${orderBy}
    LIMIT ${limit}
  `;

  const result = await db
    .tag('trailIndex.search')
    .execute(
      nearbyOnly
        ? sql`SELECT * FROM (${found}) found WHERE distance_m <= ${NEAREST_RADIUS_M} ORDER BY distance_m`
        : found,
    );

  return z.array(TrailRowSchema).parse(queryRows(result)).map(toSummary);
}

export interface TrailDetail extends TrailSummary {
  geometry: unknown;
}

export async function getTrail({
  db,
  id,
}: {
  db: TrailDb;
  id: string;
}): Promise<TrailDetail | null> {
  const result = await db.tag('trailIndex.get').execute(sql`
    SELECT ${trailColumns}, NULL AS distance_m, ST_AsGeoJSON(geom) AS geometry
    FROM trails
    WHERE id = ${id}::uuid
  `);
  const row: TrailDetailRow | undefined = z.array(TrailDetailRowSchema).parse(queryRows(result))[0];
  if (!row) return null;
  return { ...toSummary(row), geometry: safeJsonParse(row.geometry) };
}
