import { sql } from 'drizzle-orm';
import { bigint, customType, index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

// PostGIS geometry — drizzle-kit 0.28+ emits customType dataType() verbatim when the
// type string starts with a known native PG type name ('geometry' is on that list).
const geometry = customType<{ data: string; driverData: string }>({
  dataType(config?: { type?: string; srid?: number }) {
    const type = config?.type ?? 'Geometry';
    const srid = config?.srid ?? 4326;
    return `geometry(${type},${srid})`;
  },
});

// ── osm_ways ─────────────────────────────────────────────────────────────────

export const osmWays = pgTable(
  'osm_ways',
  {
    osmId: bigint('osm_id', { mode: 'bigint' }).primaryKey().notNull(),
    name: text('name'),
    sport: text('sport'),
    surface: text('surface'),
    difficulty: text('difficulty'),
    geometry: geometry('geometry', { type: 'LineString', srid: 4326 }),
  },
  (t) => [
    // Geometry GiST index for spatial queries
    index('osm_ways_geometry_idx').using('gist', t.geometry),
    // Functional geography index — enables ST_DWithin(::geography, ..., meters)
    index('osm_ways_geography_idx').using('gist', sql`(${t.geometry}::geography)`),
    index('osm_ways_sport_idx').on(t.sport).where(sql`${t.sport} IS NOT NULL`),
    // gin_trgm_ops enables fast ILIKE '%query%' via pg_trgm extension
    index('osm_ways_name_trgm_idx')
      .using('gin', t.name.op('gin_trgm_ops'))
      .where(sql`${t.name} IS NOT NULL`),
  ],
);

// ── osm_routes ───────────────────────────────────────────────────────────────

export const osmRoutes = pgTable(
  'osm_routes',
  {
    osmId: bigint('osm_id', { mode: 'bigint' }).primaryKey().notNull(),
    name: text('name'),
    sport: text('sport'),
    network: text('network'),
    distance: text('distance'),
    difficulty: text('difficulty'),
    description: text('description'),
    members: jsonb('members').$type<Array<{ type: string; ref: number; role: string }>>(),
    geometry: geometry('geometry', { type: 'MultiLineString', srid: 4326 }),
  },
  (t) => [
    index('osm_routes_geometry_idx').using('gist', t.geometry),
    index('osm_routes_geography_idx').using('gist', sql`(${t.geometry}::geography)`),
    index('osm_routes_sport_idx').on(t.sport).where(sql`${t.sport} IS NOT NULL`),
    index('osm_routes_network_idx').on(t.network).where(sql`${t.network} IS NOT NULL`),
    index('osm_routes_name_trgm_idx')
      .using('gin', t.name.op('gin_trgm_ops'))
      .where(sql`${t.name} IS NOT NULL`),
  ],
);
