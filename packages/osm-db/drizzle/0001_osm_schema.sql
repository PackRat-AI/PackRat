CREATE TABLE "osm_routes" (
	"osm_id" bigint PRIMARY KEY NOT NULL,
	"name" text,
	"sport" text,
	"network" text,
	"distance" text,
	"difficulty" text,
	"description" text,
	"members" jsonb,
	"geometry" geometry(MultiLineString,4326)
);
--> statement-breakpoint
CREATE TABLE "osm_ways" (
	"osm_id" bigint PRIMARY KEY NOT NULL,
	"name" text,
	"sport" text,
	"surface" text,
	"difficulty" text,
	"geometry" geometry(LineString,4326)
);
--> statement-breakpoint
CREATE INDEX "osm_routes_geometry_idx" ON "osm_routes" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX "osm_routes_geography_idx" ON "osm_routes" USING gist (("geometry"::geography));--> statement-breakpoint
CREATE INDEX "osm_routes_sport_idx" ON "osm_routes" USING btree ("sport") WHERE "osm_routes"."sport" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "osm_routes_network_idx" ON "osm_routes" USING btree ("network") WHERE "osm_routes"."network" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "osm_routes_name_trgm_idx" ON "osm_routes" USING gin ("name" gin_trgm_ops) WHERE "osm_routes"."name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "osm_ways_geometry_idx" ON "osm_ways" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX "osm_ways_geography_idx" ON "osm_ways" USING gist (("geometry"::geography));--> statement-breakpoint
CREATE INDEX "osm_ways_sport_idx" ON "osm_ways" USING btree ("sport") WHERE "osm_ways"."sport" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "osm_ways_name_trgm_idx" ON "osm_ways" USING gin ("name" gin_trgm_ops) WHERE "osm_ways"."name" IS NOT NULL;