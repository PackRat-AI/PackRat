CREATE TABLE "trip_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"metric" text NOT NULL,
	"target" real NOT NULL,
	"year" integer,
	"name" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"local_created_at" timestamp NOT NULL,
	"local_updated_at" timestamp NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "trip_stats_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean,
	"break_reason" text,
	"break_reason_trip_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "log" jsonb;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "excluded_from_stats" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_goals" ADD CONSTRAINT "trip_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stats_entries" ADD CONSTRAINT "trip_stats_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stats_settings" ADD CONSTRAINT "trip_stats_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_goals_user_id_idx" ON "trip_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trip_stats_entries_user_id_idx" ON "trip_stats_entries" USING btree ("user_id");