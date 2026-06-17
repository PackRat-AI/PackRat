-- Continue UUID migration: Add name column and create Better Auth tables

ALTER TABLE "users" ADD COLUMN "name" text;--> statement-breakpoint
UPDATE "users"
SET "name" = TRIM(COALESCE("first_name", '') || ' ' || COALESCE("last_name", ''))
WHERE "first_name" IS NOT NULL OR "last_name" IS NOT NULL;--> statement-breakpoint
UPDATE "users"
SET "name" = SPLIT_PART("email", '@', 1)
WHERE "name" IS NULL OR "name" = '';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint

CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "session_token_idx" ON "session" ("token");--> statement-breakpoint

CREATE TABLE "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  UNIQUE ("provider_id", "account_id")
);--> statement-breakpoint

CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp
);--> statement-breakpoint

CREATE TABLE "jwks" (
  "id" text PRIMARY KEY NOT NULL,
  "public_key" text NOT NULL,
  "private_key" text NOT NULL,
  "created_at" timestamp NOT NULL
);