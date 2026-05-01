-- Add last_active_at tracking to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" timestamp;
--> statement-breakpoint

-- Add soft-delete to users (deletedAt-based, for compliance-friendly hard delete)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint

-- Add deletedAt audit timestamps to tables that already have deleted: boolean
ALTER TABLE "packs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "pack_items" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "pack_templates" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint

-- Add soft-delete to social feed tables
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint

-- Backfill deleted_at for already-soft-deleted records (approximate timestamp)
UPDATE "packs" SET "deleted_at" = "updated_at" WHERE "deleted" = true AND "deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "pack_items" SET "deleted_at" = "updated_at" WHERE "deleted" = true AND "deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "pack_templates" SET "deleted_at" = "updated_at" WHERE "deleted" = true AND "deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "pack_template_items" SET "deleted_at" = "updated_at" WHERE "deleted" = true AND "deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "trips" SET "deleted_at" = "updated_at" WHERE "deleted" = true AND "deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "trail_condition_reports" SET "deleted_at" = "updated_at" WHERE "deleted" = true AND "deleted_at" IS NULL;
--> statement-breakpoint

-- Index for last_active_at queries (admin user listing, analytics)
CREATE INDEX IF NOT EXISTS "users_last_active_at_idx" ON "users" ("last_active_at" DESC NULLS LAST);
--> statement-breakpoint

-- Partial index: quickly find soft-deleted users
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" ("deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

-- Partial index: quickly find soft-deleted posts
CREATE INDEX IF NOT EXISTS "posts_deleted_at_idx" ON "posts" ("deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

-- Partial index: active users sorted by last activity (admin dashboard)
CREATE INDEX IF NOT EXISTS "users_active_last_active_idx" ON "users" ("last_active_at" DESC NULLS LAST) WHERE "deleted_at" IS NULL;
