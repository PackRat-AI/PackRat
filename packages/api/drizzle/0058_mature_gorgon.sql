CREATE TABLE "trip_stats_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"park_code" text,
	"name" text,
	"elevation_meters" real,
	"latitude" double precision,
	"longitude" double precision,
	"osm_id" bigint,
	"date" timestamp,
	"local_created_at" timestamp NOT NULL,
	"local_updated_at" timestamp NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_stats_entries" ADD CONSTRAINT "trip_stats_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_stats_entries_user_id_idx" ON "trip_stats_entries" USING btree ("user_id");