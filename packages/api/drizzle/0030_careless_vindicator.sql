ALTER TABLE "pack_items" ALTER COLUMN "consumable" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_items" ALTER COLUMN "worn" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_items" ALTER COLUMN "deleted" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_template_items" ALTER COLUMN "consumable" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_template_items" ALTER COLUMN "worn" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_template_items" ALTER COLUMN "deleted" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_templates" ALTER COLUMN "is_app_template" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_templates" ALTER COLUMN "deleted" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ALTER COLUMN "is_public" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ALTER COLUMN "deleted" SET NOT NULL;