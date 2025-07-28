UPDATE "catalog_items" SET "categories" = '[]'::jsonb WHERE "categories" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "categories" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "images" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
CREATE TYPE "availability" AS ENUM ('in_stock', 'out_of_stock', 'preorder');--> statement-breakpoint
UPDATE "catalog_items" SET "product_url" = '' WHERE "product_url" IS NULL; --> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "product_url" SET NOT NULL;--> statement-breakpoint
UPDATE "catalog_items" SET "availability" = NULL WHERE "availability" NOT IN ('in_stock', 'out_of_stock', 'preorder');--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "availability" SET DATA TYPE availability USING "availability"::availability;--> statement-breakpoint
ALTER TABLE "catalog_items" DROP COLUMN "url";