ALTER TABLE "trips" DROP CONSTRAINT "trips_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "local_created_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "local_updated_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;