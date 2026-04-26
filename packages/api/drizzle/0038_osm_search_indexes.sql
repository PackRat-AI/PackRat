-- Index on trips.trail_osm_id for reverse lookups (which trips use a given OSM route).
CREATE INDEX IF NOT EXISTS "trips_trail_osm_id_idx"
  ON "trips" (trail_osm_id)
  WHERE trail_osm_id IS NOT NULL;
