-- Link trips to any OSM route relation (no FK — OSM data lives in a separate database)
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "trail_osm_id" bigint;
--> statement-breakpoint

-- Index for reverse lookups (which trips reference a given OSM route)
CREATE INDEX IF NOT EXISTS "trips_trail_osm_id_idx"
  ON "trips" (trail_osm_id)
  WHERE trail_osm_id IS NOT NULL;
