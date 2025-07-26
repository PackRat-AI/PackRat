CREATE TABLE "catalog_item_etl_jobs" (
	"catalog_item_id" integer NOT NULL,
	"etl_job_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_item_etl_jobs_catalog_item_id_etl_job_id_pk" PRIMARY KEY("catalog_item_id","etl_job_id")
);
--> statement-breakpoint
ALTER TABLE "catalog_item_etl_jobs" ADD CONSTRAINT "catalog_item_etl_jobs_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_item_etl_jobs" ADD CONSTRAINT "catalog_item_etl_jobs_etl_job_id_etl_jobs_id_fk" FOREIGN KEY ("etl_job_id") REFERENCES "public"."etl_jobs"("id") ON DELETE cascade ON UPDATE no action;