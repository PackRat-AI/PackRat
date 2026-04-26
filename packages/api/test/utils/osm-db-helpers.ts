// Raw-SQL seeding helpers for hiking_ways and hiking_relations.
// These tables are NOT in the Drizzle schema (managed by osm2pgsql in prod)
// so we seed them via db.execute() with PostGIS geometry literals.

import { createDb } from '@packrat/api/db';
import { sql } from 'drizzle-orm';
import type { HikingRelationOpts, HikingWayOpts, OsmMember } from '../fixtures/trail-fixtures';
import { DEFAULT_RELATION_WKT, DEFAULT_WAY_WKT } from '../fixtures/trail-fixtures';

function quoted(s: string | null | undefined): string {
  if (s == null) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Seeds a single hiking_ways row via raw PostGIS SQL.
 * Returns the osm_id so callers can reference it in relations.
 */
export async function seedHikingWay(opts: HikingWayOpts): Promise<number> {
  const db = createDb();
  const wkt = opts.geometryWkt ?? DEFAULT_WAY_WKT;

  await db.execute(sql.raw(`
    INSERT INTO hiking_ways (osm_id, name, surface, difficulty, access, foot, geometry)
    VALUES (
      ${opts.osmId},
      ${quoted(opts.name)},
      ${quoted(opts.surface)},
      ${quoted(opts.difficulty)},
      ${quoted(opts.access)},
      ${quoted(opts.foot)},
      ST_SetSRID(ST_GeomFromText('${wkt.replace(/'/g, "''")}'), 4326)
    )
    ON CONFLICT (osm_id) DO UPDATE SET
      name     = EXCLUDED.name,
      surface  = EXCLUDED.surface,
      geometry = EXCLUDED.geometry
  `));

  return opts.osmId;
}

/**
 * Seeds multiple hiking_ways rows.
 */
export async function seedHikingWays(rows: HikingWayOpts[]): Promise<number[]> {
  return Promise.all(rows.map(seedHikingWay));
}

/**
 * Seeds a single hiking_relations row via raw PostGIS SQL.
 *
 * Pass `geometryWkt: null` to leave the geometry column NULL — this exercises
 * the runtime ST_LineMerge stitching code path in the geometry endpoint.
 *
 * Returns the osm_id.
 */
export async function seedHikingRelation(opts: HikingRelationOpts): Promise<number> {
  const db = createDb();
  const members: OsmMember[] = opts.members ?? [];
  const membersJson = JSON.stringify(members).replace(/'/g, "''");

  const wkt = opts.geometryWkt !== undefined ? opts.geometryWkt : DEFAULT_RELATION_WKT;
  const geometrySql =
    wkt != null
      ? `ST_SetSRID(ST_GeomFromText('${wkt.replace(/'/g, "''")}'), 4326)`
      : 'NULL';

  await db.execute(sql.raw(`
    INSERT INTO hiking_relations
      (osm_id, name, network, distance, difficulty, description, members, geometry)
    VALUES (
      ${opts.osmId},
      ${quoted(opts.name)},
      ${quoted(opts.network)},
      ${quoted(opts.distance)},
      ${quoted(opts.difficulty)},
      ${quoted(opts.description)},
      '${membersJson}'::jsonb,
      ${geometrySql}
    )
    ON CONFLICT (osm_id) DO UPDATE SET
      name     = EXCLUDED.name,
      members  = EXCLUDED.members,
      geometry = EXCLUDED.geometry
  `));

  return opts.osmId;
}
