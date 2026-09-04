CREATE TYPE "public"."client_platform" AS ENUM('ios', 'android', 'macos');--> statement-breakpoint
CREATE TABLE "feature_flag_platform_overrides" (
	"key" text NOT NULL,
	"platform" "client_platform" NOT NULL,
	"enabled" boolean NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flag_platform_overrides_key_platform_pk" PRIMARY KEY("key","platform")
);
--> statement-breakpoint
ALTER TABLE "feature_flag_platform_overrides" ADD CONSTRAINT "feature_flag_platform_overrides_key_feature_flags_key_fk" FOREIGN KEY ("key") REFERENCES "public"."feature_flags"("key") ON DELETE cascade ON UPDATE no action;