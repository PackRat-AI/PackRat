-- Enable PostGIS (pre-installed on Neon, safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint

-- Individual trail segments — populated by osm2pgsql flex output (routes.lua).
-- sport column carries the activity type (hiking, cycling, skiing, …) so a
-- single table serves all outdoor route types without schema changes.
CREATE TABLE IF NOT EXISTS "osm_ways" (
  "osm_id"     bigint PRIMARY KEY NOT NULL,
  "name"       text,
  "sport"      text,
  "surface"    text,
  "difficulty" text,
  "geometry"   geometry(LineString, 4326)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "osm_ways_geometry_idx"
  ON "osm_ways" USING gist("geometry");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "osm_ways_sport_idx"
  ON "osm_ways" ("sport")
  WHERE "sport" IS NOT NULL;
--> statement-breakpoint

-- Named routes assembled from OSM relations — one row per named trail/route.
-- geometry is built by osm2pgsql from member ways; members JSONB enables
-- runtime ST_LineMerge stitching when osm2pgsql leaves geometry NULL.
CREATE TABLE IF NOT EXISTS "osm_routes" (
  "osm_id"      bigint PRIMARY KEY NOT NULL,
  "name"        text,
  "sport"       text,
  "network"     text,
  "distance"    text,
  "difficulty"  text,
  "description" text,
  "members"     jsonb,
  "geometry"    geometry(MultiLineString, 4326)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "osm_routes_geometry_idx"
  ON "osm_routes" USING gist("geometry");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "osm_routes_sport_idx"
  ON "osm_routes" ("sport")
  WHERE "sport" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "osm_routes_network_idx"
  ON "osm_routes" ("network")
  WHERE "network" IS NOT NULL;
--> statement-breakpoint

-- Link trips to any OSM route relation (no FK — OSM data lives outside Drizzle)
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "trail_osm_id" bigint;
