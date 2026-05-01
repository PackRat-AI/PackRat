-- Migration: Replace integer PK on users with UUID, install Better Auth tables,
-- and drop legacy auth tables (auth_providers, refresh_tokens, one_time_passwords).
--
-- Order of operations:
--   1. Extend users table (new_id uuid, name text)
--   2. Create Better Auth tables (session, account, verification, jwks)
--   3. Migrate credential + OAuth data into account table
--   4. Drop legacy auth tables
--   5. Add temp uuid columns to all FK tables
--   6. Populate uuid columns via join with users.new_id
--   7. Drop FK constraints + integer user_id columns from app tables
--   8. Rename uuid columns → user_id / reviewed_by
--   9. Re-apply NOT NULL + FK constraints with new text type
--  10. Promote users.new_id → users.id (text PK)
--  11. Recreate indexes on new user_id columns

BEGIN;

-- ─── 1. EXTEND USERS TABLE ───────────────────────────────────────────────────

ALTER TABLE "users" ADD COLUMN "new_id" text;--> statement-breakpoint
UPDATE "users" SET "new_id" = gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "new_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "name" text;--> statement-breakpoint
UPDATE "users"
SET "name" = TRIM(COALESCE("first_name", '') || ' ' || COALESCE("last_name", ''))
WHERE "first_name" IS NOT NULL OR "last_name" IS NOT NULL;--> statement-breakpoint
-- Fall back to email prefix when both name parts are null/empty
UPDATE "users"
SET "name" = SPLIT_PART("email", '@', 1)
WHERE "name" IS NULL OR "name" = '';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint

-- ─── 2. CREATE BETTER AUTH TABLES ────────────────────────────────────────────

CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "session_token_idx" ON "session" ("token");--> statement-breakpoint

CREATE TABLE "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  UNIQUE ("provider_id", "account_id")
);--> statement-breakpoint

CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp
);--> statement-breakpoint

CREATE TABLE "jwks" (
  "id" text PRIMARY KEY NOT NULL,
  "public_key" text NOT NULL,
  "private_key" text NOT NULL,
  "created_at" timestamp NOT NULL
);--> statement-breakpoint

-- ─── 3. MIGRATE DATA INTO BETTER AUTH TABLES ─────────────────────────────────

-- Credential (email+password) accounts: one account record per user with a password_hash
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

-- OAuth accounts: migrate from auth_providers (skip 'email' provider — covered above)
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

-- ─── 4. DROP LEGACY AUTH TABLES ──────────────────────────────────────────────

DROP TABLE "auth_providers" CASCADE;--> statement-breakpoint
DROP TABLE "refresh_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "one_time_passwords" CASCADE;--> statement-breakpoint

-- ─── 5. ADD TEMP UUID COLUMNS TO APP FK TABLES ───────────────────────────────

ALTER TABLE "packs" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "pack_items" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "weight_history" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "pack_templates" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "reported_content" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "reported_content" ADD COLUMN "reviewed_by_uuid" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "post_likes" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN "user_uuid" text;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD COLUMN "user_uuid" text;--> statement-breakpoint

-- ─── 6. POPULATE UUID COLUMNS ────────────────────────────────────────────────

UPDATE "packs" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "pack_items" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "weight_history" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "pack_templates" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "pack_template_items" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "trail_condition_reports" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "trips" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "reported_content" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "reported_content" t SET "reviewed_by_uuid" = u."new_id" FROM "users" u WHERE t."reviewed_by" = u."id";--> statement-breakpoint
UPDATE "posts" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "post_likes" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "post_comments" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "comment_likes" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint

-- ─── 7. DROP FK CONSTRAINTS + INTEGER USER_ID COLUMNS ────────────────────────

ALTER TABLE "packs" DROP CONSTRAINT "packs_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pack_items" DROP CONSTRAINT "pack_items_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "weight_history" DROP CONSTRAINT "weight_history_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pack_templates" DROP CONSTRAINT "pack_templates_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pack_template_items" DROP CONSTRAINT "pack_template_items_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "trail_condition_reports" DROP CONSTRAINT "trail_condition_reports_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "trips" DROP CONSTRAINT "trips_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "reported_content" DROP CONSTRAINT "reported_content_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "reported_content" DROP CONSTRAINT "reported_content_reviewed_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "post_likes" DROP CONSTRAINT "post_likes_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "post_comments" DROP CONSTRAINT "post_comments_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "comment_likes" DROP CONSTRAINT "comment_likes_user_id_users_id_fk";--> statement-breakpoint

-- DROP COLUMN also removes any index/unique constraint on that column automatically
ALTER TABLE "packs" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "pack_items" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "weight_history" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "pack_templates" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "pack_template_items" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "trail_condition_reports" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "trips" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "reported_content" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "reported_content" DROP COLUMN "reviewed_by";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "post_likes" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "post_comments" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "comment_likes" DROP COLUMN "user_id";--> statement-breakpoint

-- ─── 8. RENAME UUID COLUMNS ──────────────────────────────────────────────────

ALTER TABLE "packs" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "pack_items" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "weight_history" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "pack_templates" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "pack_template_items" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "trail_condition_reports" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "trips" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "reported_content" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "reported_content" RENAME COLUMN "reviewed_by_uuid" TO "reviewed_by";--> statement-breakpoint
ALTER TABLE "posts" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "post_likes" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "post_comments" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "comment_likes" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint

-- ─── 9. RE-APPLY NOT NULL ON USER_ID COLUMNS ─────────────────────────────────
-- Only tables where user_id was NOT NULL in the original schema

ALTER TABLE "packs" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_items" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "weight_history" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_templates" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_template_items" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reported_content" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "post_likes" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "post_comments" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "comment_likes" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- ─── 10. PROMOTE users.new_id → users.id (TEXT PK) ───────────────────────────

ALTER TABLE "users" DROP CONSTRAINT "users_pkey";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- ─── 11. RE-ADD FK CONSTRAINTS (app tables → new text users.id) ──────────────

ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "packs" ADD CONSTRAINT "packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_templates" ADD CONSTRAINT "pack_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD CONSTRAINT "pack_template_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD CONSTRAINT "trail_condition_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_content" ADD CONSTRAINT "reported_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_content" ADD CONSTRAINT "reported_content_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ─── 12. RE-ADD UNIQUE CONSTRAINTS AND INDEXES ───────────────────────────────

ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_user_id_unique" UNIQUE ("post_id", "user_id");--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_user_id_unique" UNIQUE ("comment_id", "user_id");--> statement-breakpoint

CREATE INDEX "trail_condition_reports_user_id_idx" ON "trail_condition_reports" ("user_id");--> statement-breakpoint

COMMIT;
