ALTER TABLE "catalog_items" ALTER COLUMN "categories" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "images" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "product_url" SET NOT NULL;--> statement-breakpoint
CREATE TYPE "availability" AS ENUM ('in_stock', 'out_of_stock', 'preorder');--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "availability" SET DATA TYPE availability USING "availability"::availability;--> statement-breakpoint
ALTER TABLE "catalog_items" DROP COLUMN "url";