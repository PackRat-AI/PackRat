// Fixture builders for osm_ways and osm_routes tables.
// These tables are created by the OSM migration and populated by osm2pgsql in
// production. Tests seed them directly with raw PostGIS SQL.

export interface OsmWayOpts {
  osmId: number;
  name?: string | null;
  sport?: string | null;
  surface?: string | null;
  difficulty?: string | null;
  // WKT LineString — defaults to a short segment in the Sierra Nevada
  geometryWkt?: string;
}

export interface OsmMember {
  type: 'w' | 'r' | 'n';
  ref: number;
  role: string;
}

export interface OsmRouteOpts {
  osmId: number;
  name?: string | null;
  sport?: string | null;
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

// Same coordinates wrapped as a MultiLineString for route geometry.
export const DEFAULT_ROUTE_WKT =
  'MULTILINESTRING((-118.50 37.50, -118.48 37.52, -118.45 37.55, -118.42 37.58, -118.40 37.60))';

// Centroid lat/lon of the test geometry (useful for spatial search tests).
export const TEST_GEOMETRY_LAT = 37.55;
export const TEST_GEOMETRY_LON = -118.45;
