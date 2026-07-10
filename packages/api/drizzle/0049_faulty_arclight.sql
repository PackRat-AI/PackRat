CREATE TABLE "feature_access" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"early_access_until" timestamp,
	"released_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
