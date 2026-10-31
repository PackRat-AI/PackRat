ALTER TABLE "trail_condition_reports" ADD COLUMN "trail_id" text;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD COLUMN "longitude" double precision;--> statement-breakpoint
CREATE INDEX "trail_condition_reports_trail_id_created_idx" ON "trail_condition_reports" USING btree ("trail_id","created_at" DESC NULLS LAST) WHERE "trail_condition_reports"."trail_id" IS NOT NULL AND "trail_condition_reports"."deleted" = false;