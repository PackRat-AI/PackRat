-- Migrate auth data and add temp UUID columns for foreign keys

-- Migrate credential (email+password) accounts
INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  u."new_id",
  'credential',
  u."new_id",
  u."password_hash",
  u."created_at",
  u."updated_at"
FROM "users" u
WHERE u."password_hash" IS NOT NULL
ON CONFLICT ("provider_id", "account_id") DO NOTHING;--> statement-breakpoint

-- Migrate OAuth accounts from auth_providers (if table exists)
INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  COALESCE(ap."provider_id", u."new_id"),
  ap."provider",
  u."new_id",
  COALESCE(ap."created_at", u."created_at"),
  COALESCE(ap."created_at", u."created_at")
FROM "auth_providers" ap
JOIN "users" u ON u."id" = ap."user_id"
WHERE ap."provider" != 'email'
ON CONFLICT ("provider_id", "account_id") DO NOTHING;--> statement-breakpoint

-- Add temporary UUID columns to FK tables (using IF NOT EXISTS)
ALTER TABLE "packs" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "pack_items" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "weight_history" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "pack_templates" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "reported_content" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "reported_content" ADD COLUMN IF NOT EXISTS "reviewed_by_uuid" text;