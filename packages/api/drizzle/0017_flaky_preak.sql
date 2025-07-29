ALTER TABLE "catalog_items" RENAME COLUMN "default_weight" TO "weight";--> statement-breakpoint
ALTER TABLE "catalog_items" RENAME COLUMN "default_weight_unit" TO "weight_unit";--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "categories" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "images" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "review_count" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "variants" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "qas" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "faqs" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_items" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "catalog_items" DROP COLUMN "image";