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
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entitlements_user_id_idx" ON "entitlements" USING btree ("user_id");