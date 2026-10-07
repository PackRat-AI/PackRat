ALTER TABLE "trip_goals" ADD COLUMN "trail_code" text;--> statement-breakpoint
ALTER TABLE "trip_goals" ADD COLUMN "peaks" jsonb;--> statement-breakpoint
ALTER TABLE "trip_goals" ADD COLUMN "park_codes" jsonb;