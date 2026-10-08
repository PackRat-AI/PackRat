-- 0059 was journaled with a timestamp older than 0057, so databases that had
-- already applied 0057 skipped it. Re-add its columns idempotently.
ALTER TABLE "trip_goals" ADD COLUMN IF NOT EXISTS "trail_code" text;--> statement-breakpoint
ALTER TABLE "trip_goals" ADD COLUMN IF NOT EXISTS "peaks" jsonb;--> statement-breakpoint
ALTER TABLE "trip_goals" ADD COLUMN IF NOT EXISTS "park_codes" jsonb;
