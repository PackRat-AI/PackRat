ALTER TABLE "etl_jobs" RENAME COLUMN "object_key" TO "filename";--> statement-breakpoint
ALTER TABLE "etl_jobs" RENAME COLUMN "total_count" TO "total_processed";