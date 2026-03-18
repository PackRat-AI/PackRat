CREATE TYPE "trail_condition" AS ENUM ('excellent', 'good', 'fair', 'poor', 'closed');--> statement-breakpoint
CREATE TABLE "trail_conditions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trail_name" text NOT NULL,
	"location" jsonb,
	"condition" "trail_condition" NOT NULL,
	"details" text NOT NULL,
	"photos" jsonb DEFAULT '[]',
	"trust_score" real DEFAULT 0.5 NOT NULL,
	"verified_count" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trail_conditions" ADD CONSTRAINT "trail_conditions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trail_conditions_user_id_idx" ON "trail_conditions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trail_conditions_created_at_idx" ON "trail_conditions" USING btree ("created_at");
