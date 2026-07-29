CREATE TABLE "entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"rc_app_user_id" text NOT NULL,
	"user_id" text,
	"entitlement_id" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"store" text,
	"product_id" text,
	"last_event_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entitlements_app_user_entitlement_unique" UNIQUE("rc_app_user_id","entitlement_id")
);
--> statement-breakpoint
CREATE TABLE "feature_access" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"early_access_until" timestamp,
	"released_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entitlements_user_id_idx" ON "entitlements" USING btree ("user_id");