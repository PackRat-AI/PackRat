CREATE TABLE "invalid_item_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"errors" jsonb NOT NULL,
	"raw_data" jsonb NOT NULL,
	"row_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
