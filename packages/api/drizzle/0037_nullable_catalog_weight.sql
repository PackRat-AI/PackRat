-- catalog_items.weight and weight_unit: drop NOT NULL to allow items without weight data.
-- The validator intentionally skips weight (clothing/footwear often omit it), but the
-- NOT NULL constraint was causing upserts to throw, which cascaded to ETL job failures.
ALTER TABLE "catalog_items" ALTER COLUMN "weight" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "weight_unit" DROP NOT NULL;
