ALTER TABLE "catalog_items" ALTER COLUMN "categories" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
UPDATE "catalog_items" SET "categories" = '[]'::jsonb WHERE "categories" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "categories" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "images" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
UPDATE "catalog_items" SET "images" = '[]'::jsonb WHERE "images" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "images" SET NOT NULL;