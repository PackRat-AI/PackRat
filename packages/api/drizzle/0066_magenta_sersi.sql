CREATE TABLE "notification_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"trail_conditions" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trail_condition_report_reads" (
	"user_id" text NOT NULL,
	"report_id" text NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trail_condition_report_reads_user_id_report_id_pk" PRIMARY KEY("user_id","report_id")
);
--> statement-breakpoint
CREATE TABLE "trip_condition_notification_state" (
	"trip_id" text PRIMARY KEY NOT NULL,
	"last_notified_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_condition_report_reads" ADD CONSTRAINT "trail_condition_report_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_condition_report_reads" ADD CONSTRAINT "trail_condition_report_reads_report_id_trail_condition_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."trail_condition_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_condition_notification_state" ADD CONSTRAINT "trip_condition_notification_state_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;