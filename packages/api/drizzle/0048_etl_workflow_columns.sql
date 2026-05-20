ALTER TABLE "etl_jobs" ADD COLUMN "workflow_instance_id" text;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "verified_row_count" integer;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "total_embedding_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "superseded_by_job_id" text;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "superseded_at" timestamp;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "source_etag" text;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "source_last_modified" timestamp;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD CONSTRAINT "etl_jobs_superseded_by_job_id_etl_jobs_id_fk" FOREIGN KEY ("superseded_by_job_id") REFERENCES "public"."etl_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_item_etl_jobs_catalog_job_idx" ON "catalog_item_etl_jobs" USING btree ("catalog_item_id","etl_job_id");--> statement-breakpoint
CREATE INDEX "etl_jobs_workflow_instance_id_idx" ON "etl_jobs" USING btree ("workflow_instance_id");--> statement-breakpoint
CREATE INDEX "etl_jobs_superseded_by_idx" ON "etl_jobs" USING btree ("superseded_by_job_id");--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD CONSTRAINT "etl_jobs_no_self_supersede" CHECK ("etl_jobs"."superseded_by_job_id" IS NULL OR "etl_jobs"."superseded_by_job_id" <> "etl_jobs"."id");