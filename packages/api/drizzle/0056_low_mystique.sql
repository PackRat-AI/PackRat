CREATE TYPE "public"."feed_report_reason" AS ENUM('spam', 'harassment', 'inappropriate');--> statement-breakpoint
CREATE TYPE "public"."feed_report_status" AS ENUM('pending', 'dismissed', 'removed');--> statement-breakpoint
CREATE TABLE "feed_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"post_id" integer,
	"comment_id" integer,
	"reason" "feed_report_reason" NOT NULL,
	"status" "feed_report_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_reports_one_target" CHECK (("feed_reports"."post_id" IS NULL) <> ("feed_reports"."comment_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "post_saves" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_saves_post_id_user_id_unique" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"tagged_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_tags_post_id_user_id_unique" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "social_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"allow_tagging" boolean DEFAULT true NOT NULL,
	"notify_tags" boolean DEFAULT true NOT NULL,
	"notify_comments" boolean DEFAULT true NOT NULL,
	"notify_replies" boolean DEFAULT true NOT NULL,
	"suspended_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_blocker_id_blocked_id_unique" UNIQUE("blocker_id","blocked_id")
);
--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "public_id" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "caption_edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "feed_reports" ADD CONSTRAINT "feed_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_reports" ADD CONSTRAINT "feed_reports_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_reports" ADD CONSTRAINT "feed_reports_comment_id_post_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagged_by_users_id_fk" FOREIGN KEY ("tagged_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_settings" ADD CONSTRAINT "social_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_reports_status_idx" ON "feed_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feed_reports_reporter_id_idx" ON "feed_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "post_tags_user_id_idx" ON "post_tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks" USING btree ("blocked_id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_public_id_unique" UNIQUE("public_id");