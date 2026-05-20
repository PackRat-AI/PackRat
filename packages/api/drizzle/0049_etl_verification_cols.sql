ALTER TABLE "etl_jobs" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "verified_row_count" integer;