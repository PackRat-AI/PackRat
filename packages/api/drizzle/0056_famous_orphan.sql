ALTER TABLE "trips" ADD COLUMN "log" jsonb;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "excluded_from_stats" boolean DEFAULT false NOT NULL;