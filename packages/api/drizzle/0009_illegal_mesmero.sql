CREATE TABLE "reported_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_query" text NOT NULL,
	"ai_response" text NOT NULL,
	"reason" text NOT NULL,
	"user_comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed" boolean DEFAULT false,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'USER';--> statement-breakpoint
ALTER TABLE "reported_content" ADD CONSTRAINT "reported_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_content" ADD CONSTRAINT "reported_content_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;