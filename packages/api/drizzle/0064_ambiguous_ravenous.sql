CREATE TYPE "public"."trail_condition_flag_reason" AS ENUM('inaccurate', 'offensive', 'spam');--> statement-breakpoint
CREATE TYPE "public"."trail_condition_flag_status" AS ENUM('pending', 'dismissed', 'removed');--> statement-breakpoint
CREATE TABLE "trail_condition_report_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"report_id" text NOT NULL,
	"reason" "trail_condition_flag_reason" NOT NULL,
	"status" "trail_condition_flag_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trail_condition_report_flags_reporter_report_unique" UNIQUE("reporter_id","report_id")
);
--> statement-breakpoint
ALTER TABLE "trail_condition_report_flags" ADD CONSTRAINT "trail_condition_report_flags_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_condition_report_flags" ADD CONSTRAINT "trail_condition_report_flags_report_id_trail_condition_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."trail_condition_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trail_condition_report_flags_status_idx" ON "trail_condition_report_flags" USING btree ("status");