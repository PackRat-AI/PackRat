// Trail fixture builders — for hiking_ways and hiking_relations tables.
// These tables are created by the OSM migration and populated by osm2pgsql in
// production. Tests seed them directly with raw PostGIS SQL.

export interface HikingWayOpts {
  osmId: number;
  name?: string | null;
  surface?: string | null;
  difficulty?: string | null;
  access?: string | null;
  foot?: string | null;
  // WKT LineString — defaults to a short segment in the Sierra Nevada
  geometryWkt?: string;
}

export interface OsmMember {
  type: 'w' | 'r' | 'n';
  ref: number;
  role: string;
}

export interface HikingRelationOpts {
  osmId: number;
  name?: string | null;
  network?: string | null;
  distance?: string | null;
  difficulty?: string | null;
  description?: string | null;
  members?: OsmMember[];
  // WKT MultiLineString — omit to leave geometry NULL (triggers stitching path)
  geometryWkt?: string | null;
}

// ── Geometry helpers ────────────────────────────────────────────────────────

// A short ~15 km segment in the Sierra Nevada, around the John Muir Trail area.
export const DEFAULT_WAY_WKT =
  'LINESTRING(-118.50 37.50, -118.48 37.52, -118.45 37.55, -118.42 37.58, -118.40 37.60)';

// Same coordinates wrapped as a MultiLineString for relation geometry.
export const DEFAULT_RELATION_WKT =
  'MULTILINESTRING((-118.50 37.50, -118.48 37.52, -118.45 37.55, -118.42 37.58, -118.40 37.60))';

// A second segment for multi-way stitching tests (continues from the first).
export const SECOND_WAY_WKT = 'LINESTRING(-118.40 37.60, -118.38 37.62, -118.35 37.65)';

// Centroid lat/lon of the test geometry (useful for spatial search tests).
export const TEST_GEOMETRY_LAT = 37.55;
export const TEST_GEOMETRY_LON = -118.45;

// ── Fixture factories ───────────────────────────────────────────────────────

export function makeHikingWay(overrides: HikingWayOpts): HikingWayOpts {
  return {
    osmId: overrides.osmId,
    name: overrides.name ?? 'Test Hiking Way',
    surface: overrides.surface ?? 'dirt',
    difficulty: overrides.difficulty ?? null,
    access: overrides.access ?? null,
    foot: overrides.foot ?? 'yes',
    geometryWkt: overrides.geometryWkt ?? DEFAULT_WAY_WKT,
  };
}

export function makeHikingRelation(overrides: HikingRelationOpts): HikingRelationOpts {
  return {
    osmId: overrides.osmId,
    name: overrides.name ?? 'Test Hiking Trail',
    network: overrides.network ?? 'lwn',
    distance: overrides.distance ?? '5 km',
    difficulty: overrides.difficulty ?? 'easy',
    description: overrides.description ?? null,
    members: overrides.members ?? [],
    geometryWkt: overrides.geometryWkt !== undefined ? overrides.geometryWkt : DEFAULT_RELATION_WKT,
  };
}
