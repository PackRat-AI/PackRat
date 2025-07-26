CREATE TABLE "etl_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "etl_job_status" NOT NULL,
	"source" text NOT NULL,
	"object_key" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"total_processed" integer,
	"total_valid" integer,
	"total_invalid" integer
);
--> statement-breakpoint
ALTER TABLE "invalid_item_logs" ADD CONSTRAINT "invalid_item_logs_job_id_etl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."etl_jobs"("id") ON DELETE no action ON UPDATE no action;