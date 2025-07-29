UPDATE "catalog_items" SET "weight" = 0 WHERE "weight" IS NULL;--> statement-breakpoint
UPDATE "catalog_items" SET "weight_unit" = 'g' WHERE "weight_unit" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "weight" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "weight_unit" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "categories" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "images" DROP DEFAULT;