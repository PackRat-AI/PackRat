CREATE TABLE "trail_condition_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"trail_name" text NOT NULL,
	"trail_region" text,
	"surface" text NOT NULL,
	"overall_condition" text NOT NULL,
	"hazards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"water_crossings" integer DEFAULT 0 NOT NULL,
	"water_crossing_difficulty" text,
	"notes" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_id" integer NOT NULL,
	"trip_id" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"local_created_at" timestamp NOT NULL,
	"local_updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD CONSTRAINT "trail_condition_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD CONSTRAINT "trail_condition_reports_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trail_condition_reports_user_id_idx" ON "trail_condition_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trail_condition_reports_active_created_idx" ON "trail_condition_reports" USING btree ("deleted","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trail_condition_reports_trail_name_idx" ON "trail_condition_reports" USING btree ("trail_name");