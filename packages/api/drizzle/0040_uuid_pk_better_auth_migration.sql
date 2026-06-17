-- Migration: Replace integer PK on users with UUID, install Better Auth tables,
-- and drop legacy auth tables (auth_providers, refresh_tokens, one_time_passwords).

-- ─── 1. EXTEND USERS TABLE ───────────────────────────────────────────────────

ALTER TABLE "users" ADD COLUMN "new_id" text;--> statement-breakpoint
UPDATE "users" SET "new_id" = gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "new_id" SET NOT NULL;