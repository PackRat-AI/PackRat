-- Final step: Switch users.id to UUID, add FK constraints, cleanup legacy tables

-- First drop foreign key constraints from legacy tables
ALTER TABLE "auth_providers" DROP CONSTRAINT IF EXISTS "auth_providers_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "one_time_passwords" DROP CONSTRAINT IF EXISTS "one_time_passwords_user_id_users_id_fk";--> statement-breakpoint

-- Drop social feed FK constraints that depend on users_pkey
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "post_likes" DROP CONSTRAINT IF EXISTS "post_likes_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "post_comments" DROP CONSTRAINT IF EXISTS "post_comments_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "comment_likes" DROP CONSTRAINT IF EXISTS "comment_likes_user_id_users_id_fk";--> statement-breakpoint

-- Add temporary UUID columns to social feed tables
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "post_likes" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD COLUMN IF NOT EXISTS "user_uuid" text;--> statement-breakpoint

-- Populate UUID columns from users.new_id
UPDATE "posts" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "post_likes" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "post_comments" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "comment_likes" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint

-- Drop old integer user_id columns from social feed tables
ALTER TABLE "posts" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "post_likes" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "post_comments" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "comment_likes" DROP COLUMN "user_id";--> statement-breakpoint

-- Rename UUID columns to user_id
ALTER TABLE "posts" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "post_likes" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "post_comments" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "comment_likes" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint

-- Set NOT NULL on social feed user_id columns
ALTER TABLE "posts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "post_likes" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "post_comments" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "comment_likes" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- Switch users table primary key from integer to text UUID
ALTER TABLE "users" DROP CONSTRAINT "users_pkey";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Re-add foreign key constraints to Better Auth tables
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Re-add foreign key constraints to application tables
ALTER TABLE "packs" ADD CONSTRAINT "packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_templates" ADD CONSTRAINT "pack_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD CONSTRAINT "pack_template_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD CONSTRAINT "trail_condition_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_content" ADD CONSTRAINT "reported_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_content" ADD CONSTRAINT "reported_content_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Re-add foreign key constraints to social feed tables
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Drop legacy auth tables
DROP TABLE "auth_providers" CASCADE;--> statement-breakpoint
DROP TABLE "refresh_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "one_time_passwords" CASCADE;
