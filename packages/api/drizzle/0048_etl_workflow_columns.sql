ALTER TABLE "etl_jobs" ADD COLUMN "workflow_instance_id" text;--> statement-breakpoint
ALTER TABLE "etl_jobs" ADD COLUMN "total_embedding_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "etl_jobs_workflow_instance_id_idx" ON "etl_jobs" USING btree ("workflow_instance_id");