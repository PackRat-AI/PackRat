-- Enable PostGIS (pre-installed on Neon, safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint

-- Individual trail segments — populated by osm2pgsql flex output (hiking.lua)
CREATE TABLE IF NOT EXISTS "hiking_ways" (
  "osm_id"     bigint PRIMARY KEY NOT NULL,
  "name"       text,
  "surface"    text,
  "difficulty" text,
  "access"     text,
  "foot"       text,
  "geometry"   geometry(LineString, 4326)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hiking_ways_geometry_idx"
  ON "hiking_ways" USING gist("geometry");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hiking_ways_name_idx"
  ON "hiking_ways" ("name")
  WHERE "name" IS NOT NULL;
--> statement-breakpoint

-- Named hiking routes — populated by osm2pgsql flex output (hiking.lua)
-- geometry is assembled by osm2pgsql from member ways; members JSONB enables
-- runtime stitching fallback via ST_LineMerge when needed
CREATE TABLE IF NOT EXISTS "hiking_relations" (
  "osm_id"      bigint PRIMARY KEY NOT NULL,
  "name"        text,
  "network"     text,
  "distance"    text,
  "difficulty"  text,
  "description" text,
  "members"     jsonb,
  "geometry"    geometry(MultiLineString, 4326),
  "cached_at"   timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hiking_relations_geometry_idx"
  ON "hiking_relations" USING gist("geometry");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hiking_relations_name_idx"
  ON "hiking_relations" ("name")
  WHERE "name" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hiking_relations_network_idx"
  ON "hiking_relations" ("network")
  WHERE "network" IS NOT NULL;
--> statement-breakpoint

-- Link trips to OSM trail relations (no FK — OSM data lives outside Drizzle)
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "trail_osm_id" bigint;
