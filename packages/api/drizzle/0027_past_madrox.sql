ALTER TABLE "etl_jobs" ADD COLUMN "scraper_revision" text;--> statement-breakpoint
UPDATE "etl_jobs"
SET "scraper_revision" = '2a20528ad93e8df5cd1ae0eb1e408f5c6512bb09'
WHERE "scraper_revision" IS NULL;--> statement-breakpoint
ALTER TABLE "etl_jobs" ALTER COLUMN "scraper_revision" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "etl_jobs_scraper_revision_idx" ON "etl_jobs" USING btree ("scraper_revision");