CREATE TABLE "user_device_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"device_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_device_tokens_user_id_device_token_unique" UNIQUE("user_id","device_token")
);
--> statement-breakpoint
CREATE TABLE "weather_location_alert_state" (
	"weather_location_id" integer PRIMARY KEY NOT NULL,
	"last_alert_hash" text,
	"last_alert_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"poll_tier" text DEFAULT 'baseline' NOT NULL,
	"active_since" timestamp,
	"last_polled_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_watched_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"weather_location_id" integer NOT NULL,
	"location_name" text NOT NULL,
	"region" text,
	"country" text,
	"lat" real NOT NULL,
	"lon" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "weather_watched_locations_user_location_unique" UNIQUE("user_id","weather_location_id")
);
--> statement-breakpoint
ALTER TABLE "user_device_tokens" ADD CONSTRAINT "user_device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_watched_locations" ADD CONSTRAINT "weather_watched_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_device_tokens_user_id_idx" ON "user_device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "weather_watched_locations_weather_location_id_idx" ON "weather_watched_locations" USING btree ("weather_location_id");