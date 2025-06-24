ALTER TABLE "pack_templates" RENAME COLUMN "is_public" TO "is_app_template";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'USER';--> statement-breakpoint
ALTER TABLE "pack_template_items" DROP COLUMN "local_created_at";--> statement-breakpoint
ALTER TABLE "pack_template_items" DROP COLUMN "local_updated_at";