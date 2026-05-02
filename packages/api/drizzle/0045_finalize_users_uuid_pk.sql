-- Final step: Switch users.id to UUID, add FK constraints, cleanup legacy tables

-- First drop foreign key constraints from legacy tables
ALTER TABLE "auth_providers" DROP CONSTRAINT IF EXISTS "auth_providers_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "one_time_passwords" DROP CONSTRAINT IF EXISTS "one_time_passwords_user_id_users_id_fk";--> statement-breakpoint

-- Switch users table primary key from integer to text UUID
ALTER TABLE "users" DROP CONSTRAINT "users_pkey";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Re-add foreign key constraints to Better Auth tables
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Re-add foreign key constraints to application tables
ALTER TABLE "packs" ADD CONSTRAINT "packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_templates" ADD CONSTRAINT "pack_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD CONSTRAINT "pack_template_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD CONSTRAINT "trail_condition_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_content" ADD CONSTRAINT "reported_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_content" ADD CONSTRAINT "reported_content_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Drop legacy auth tables
DROP TABLE "auth_providers" CASCADE;--> statement-breakpoint
DROP TABLE "refresh_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "one_time_passwords" CASCADE;