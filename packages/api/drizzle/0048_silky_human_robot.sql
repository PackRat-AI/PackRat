CREATE TABLE "request_query_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"route" text NOT NULL,
	"method" text NOT NULL,
	"status_code" integer,
	"total_duration_ms" integer DEFAULT 0 NOT NULL,
	"estimated_egress_bytes" integer DEFAULT 0 NOT NULL,
	"query_count" integer DEFAULT 0 NOT NULL,
	"user_id" text,
	"queries" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rqm_captured_at_idx" ON "request_query_metrics" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "rqm_route_idx" ON "request_query_metrics" USING btree ("route");