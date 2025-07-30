DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'catalog_items' 
        AND column_name = 'default_weight'
    ) THEN
        ALTER TABLE "catalog_items" RENAME COLUMN "default_weight" TO "weight";
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'catalog_items' 
        AND column_name = 'default_weight'
    ) THEN
        ALTER TABLE "catalog_items" RENAME COLUMN "default_weight_unit" TO "weight_unit";
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "categories" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "images" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "review_count" integer;--> statement-breakpoint
UPDATE "catalog_items" SET "review_count" = 0 WHERE "review_count" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "review_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "variants" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "qas" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "faqs" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "catalog_items" DROP COLUMN "image";