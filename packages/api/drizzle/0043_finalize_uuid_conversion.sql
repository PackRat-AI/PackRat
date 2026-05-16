-- Final step: Populate UUIDs, drop integer FKs, switch users.id to UUID

-- Populate UUID columns with user UUIDs
UPDATE "packs" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "pack_items" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "weight_history" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "pack_templates" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "pack_template_items" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "trail_condition_reports" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "trips" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "reported_content" t SET "user_uuid" = u."new_id" FROM "users" u WHERE t."user_id" = u."id";--> statement-breakpoint
UPDATE "reported_content" t SET "reviewed_by_uuid" = u."new_id" FROM "users" u WHERE t."reviewed_by" = u."id";--> statement-breakpoint

-- Drop foreign key constraints
ALTER TABLE "packs" DROP CONSTRAINT IF EXISTS "packs_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pack_items" DROP CONSTRAINT IF EXISTS "pack_items_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "weight_history" DROP CONSTRAINT IF EXISTS "weight_history_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pack_templates" DROP CONSTRAINT IF EXISTS "pack_templates_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pack_template_items" DROP CONSTRAINT IF EXISTS "pack_template_items_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "trail_condition_reports" DROP CONSTRAINT IF EXISTS "trail_condition_reports_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "trips_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "reported_content" DROP CONSTRAINT IF EXISTS "reported_content_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "reported_content" DROP CONSTRAINT IF EXISTS "reported_content_reviewed_by_users_id_fk";