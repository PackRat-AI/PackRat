CREATE TABLE "emergency_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"introduced_at" timestamp,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emergency_contacts_phone_or_email" CHECK ("emergency_contacts"."phone" IS NOT NULL OR "emergency_contacts"."email" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "safety_check_in_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"check_in_id" text NOT NULL,
	"contact_id" text,
	"name" text NOT NULL,
	"phone" text,
	"email" text
);
--> statement-breakpoint
CREATE TABLE "safety_check_in_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"check_in_id" text NOT NULL,
	"kind" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"accuracy_meters" real,
	"place_name" text,
	"note" text,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_check_ins" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"share_token" text NOT NULL,
	"expected_return_at" timestamp NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"grace_minutes" integer DEFAULT 120 NOT NULL,
	"identifying_gear" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tracking_enabled" boolean DEFAULT false NOT NULL,
	"started_at" timestamp NOT NULL,
	"overdue_alert_sent_at" timestamp,
	"off_route_notified_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "safety_check_ins_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "status" text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "planned_route" jsonb;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_check_in_contacts" ADD CONSTRAINT "safety_check_in_contacts_check_in_id_safety_check_ins_id_fk" FOREIGN KEY ("check_in_id") REFERENCES "public"."safety_check_ins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_check_in_contacts" ADD CONSTRAINT "safety_check_in_contacts_contact_id_emergency_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."emergency_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_check_in_locations" ADD CONSTRAINT "safety_check_in_locations_check_in_id_safety_check_ins_id_fk" FOREIGN KEY ("check_in_id") REFERENCES "public"."safety_check_ins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_check_ins" ADD CONSTRAINT "safety_check_ins_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_check_ins" ADD CONSTRAINT "safety_check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emergency_contacts_user_id_idx" ON "emergency_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "safety_check_in_contacts_check_in_id_idx" ON "safety_check_in_contacts" USING btree ("check_in_id");--> statement-breakpoint
CREATE INDEX "safety_check_in_locations_check_in_recorded_idx" ON "safety_check_in_locations" USING btree ("check_in_id","recorded_at");--> statement-breakpoint
CREATE INDEX "safety_check_ins_user_id_idx" ON "safety_check_ins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "safety_check_ins_trip_id_idx" ON "safety_check_ins" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "safety_check_ins_status_expected_return_idx" ON "safety_check_ins" USING btree ("status","expected_return_at");