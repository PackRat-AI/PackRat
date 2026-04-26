// Raw-SQL seeding helpers for osm_ways and osm_routes.
// Schema is defined in packages/osm-db; seeding uses raw PostGIS SQL
// since geometry literals can't be expressed through Drizzle's insert API.

import { createOsmDb } from '@packrat/api/db';
import { sql } from 'drizzle-orm';
import {
  DEFAULT_ROUTE_WKT,
  DEFAULT_WAY_WKT,
  type OsmMember,
  type OsmRouteOpts,
  type OsmWayOpts,
} from '../fixtures/trail-fixtures';

function quoted(s: string | null | undefined): string {
  if (s == null) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Seeds a single osm_ways row via raw PostGIS SQL.
 * Returns the osm_id so callers can reference it in routes.
 */
export async function seedOsmWay(opts: OsmWayOpts): Promise<number> {
  const db = createOsmDb();
  const wkt = opts.geometryWkt ?? DEFAULT_WAY_WKT;

  await db.execute(
    sql.raw(`
    INSERT INTO osm_ways (osm_id, name, sport, surface, difficulty, geometry)
    VALUES (
      ${opts.osmId},
      ${quoted(opts.name)},
      ${quoted(opts.sport)},
      ${quoted(opts.surface)},
      ${quoted(opts.difficulty)},
      ST_SetSRID(ST_GeomFromText('${wkt.replace(/'/g, "''")}'), 4326)
    )
    ON CONFLICT (osm_id) DO UPDATE SET
      name     = EXCLUDED.name,
      sport    = EXCLUDED.sport,
      surface  = EXCLUDED.surface,
      geometry = EXCLUDED.geometry
  `),
  );

  return opts.osmId;
}

/**
 * Seeds a single osm_routes row via raw PostGIS SQL.
 *
 * Pass `geometryWkt: null` to leave the geometry column NULL — this exercises
 * the runtime ST_LineMerge stitching code path in the geometry endpoint.
 *
 * Returns the osm_id.
 */
export async function seedOsmRoute(opts: OsmRouteOpts): Promise<number> {
  const db = createOsmDb();
  const members: OsmMember[] = opts.members ?? [];
  const membersJson = JSON.stringify(members).replace(/'/g, "''");

  const wkt = opts.geometryWkt !== undefined ? opts.geometryWkt : DEFAULT_ROUTE_WKT;
  const geometrySql =
    wkt != null ? `ST_SetSRID(ST_GeomFromText('${wkt.replace(/'/g, "''")}'), 4326)` : 'NULL';

  await db.execute(
    sql.raw(`
    INSERT INTO osm_routes
      (osm_id, name, sport, network, distance, difficulty, description, members, geometry)
    VALUES (
      ${opts.osmId},
      ${quoted(opts.name)},
      ${quoted(opts.sport)},
      ${quoted(opts.network)},
      ${quoted(opts.distance)},
      ${quoted(opts.difficulty)},
      ${quoted(opts.description)},
      '${membersJson}'::jsonb,
      ${geometrySql}
    )
    ON CONFLICT (osm_id) DO UPDATE SET
      name     = EXCLUDED.name,
      sport    = EXCLUDED.sport,
      members  = EXCLUDED.members,
      geometry = EXCLUDED.geometry
  `),
  );

  return opts.osmId;
}
