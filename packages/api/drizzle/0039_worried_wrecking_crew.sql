ALTER TABLE "pack_items" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "pack_templates" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN "deleted_at" timestamp;