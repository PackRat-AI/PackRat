ALTER TABLE "catalog_item_etl_jobs" DROP CONSTRAINT "catalog_item_etl_jobs_catalog_item_id_etl_job_id_pk";--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "categories" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "categories" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "images" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "images" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_item_etl_jobs" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;