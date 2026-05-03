-- Create social feed tables with UUID user_id if they were never previously migrated

CREATE TABLE IF NOT EXISTS "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"caption" text,
	"images" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_likes_post_id_user_id_unique" UNIQUE("post_id","user_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"parent_comment_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_likes_comment_id_user_id_unique" UNIQUE("comment_id","user_id")
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'posts_user_id_users_id_fk') THEN
    ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'post_likes_post_id_posts_id_fk') THEN
    ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fk"
      FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'post_likes_user_id_users_id_fk') THEN
    ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'post_comments_post_id_posts_id_fk') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_posts_id_fk"
      FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'post_comments_user_id_users_id_fk') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'post_comments_parent_comment_id_post_comments_id_fk') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_comment_id_post_comments_id_fk"
      FOREIGN KEY ("parent_comment_id") REFERENCES "post_comments"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'comment_likes_comment_id_post_comments_id_fk') THEN
    ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_post_comments_id_fk"
      FOREIGN KEY ("comment_id") REFERENCES "post_comments"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'comment_likes_user_id_users_id_fk') THEN
    ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
