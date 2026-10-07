CREATE TABLE "trip_destination_alert_state" (
	"trip_id" text PRIMARY KEY NOT NULL,
	"last_alert_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_polled_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_destination_alert_state" ADD CONSTRAINT "trip_destination_alert_state_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;