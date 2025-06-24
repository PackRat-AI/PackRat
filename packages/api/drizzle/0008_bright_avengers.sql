ALTER TABLE "weight_history" DROP CONSTRAINT "weight_history_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;