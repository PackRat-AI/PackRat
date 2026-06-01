-- Complete UUID conversion: drop integer columns, rename UUID columns, switch users.id

-- Drop old integer user_id columns
ALTER TABLE "packs" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "pack_items" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "weight_history" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "pack_templates" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "pack_template_items" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "trail_condition_reports" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "trips" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "reported_content" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "reported_content" DROP COLUMN "reviewed_by";--> statement-breakpoint

-- Rename UUID columns to user_id
ALTER TABLE "packs" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "pack_items" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "weight_history" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "pack_templates" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "pack_template_items" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "trail_condition_reports" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "trips" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "reported_content" RENAME COLUMN "user_uuid" TO "user_id";--> statement-breakpoint
ALTER TABLE "reported_content" RENAME COLUMN "reviewed_by_uuid" TO "reviewed_by";--> statement-breakpoint

-- Set NOT NULL on user_id columns (where required)
ALTER TABLE "packs" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_items" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "weight_history" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_templates" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_template_items" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reported_content" ALTER COLUMN "user_id" SET NOT NULL;