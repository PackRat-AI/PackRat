-- Phase 1 of the client/server ID split (docs/design/client-uuid-split.md §3 Option C).
-- Add `client_uuid` as an idempotency token alongside the existing `id` PK.
-- Backfilled from existing `id` so old rows continue to round-trip.
-- Format CHECK enforces URL-safe nanoid charset, ≤64 chars.

-- pack_items
ALTER TABLE "pack_items" ADD COLUMN "client_uuid" text;--> statement-breakpoint
UPDATE "pack_items" SET "client_uuid" = "id" WHERE "client_uuid" IS NULL;--> statement-breakpoint
ALTER TABLE "pack_items" ALTER COLUMN "client_uuid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_client_uuid_unique" UNIQUE("client_uuid");--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_client_uuid_format" CHECK ("client_uuid" ~ '^[A-Za-z0-9_-]{1,64}$');--> statement-breakpoint

-- pack_template_items
ALTER TABLE "pack_template_items" ADD COLUMN "client_uuid" text;--> statement-breakpoint
UPDATE "pack_template_items" SET "client_uuid" = "id" WHERE "client_uuid" IS NULL;--> statement-breakpoint
ALTER TABLE "pack_template_items" ALTER COLUMN "client_uuid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD CONSTRAINT "pack_template_items_client_uuid_unique" UNIQUE("client_uuid");--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD CONSTRAINT "pack_template_items_client_uuid_format" CHECK ("client_uuid" ~ '^[A-Za-z0-9_-]{1,64}$');--> statement-breakpoint

-- pack_templates
ALTER TABLE "pack_templates" ADD COLUMN "client_uuid" text;--> statement-breakpoint
UPDATE "pack_templates" SET "client_uuid" = "id" WHERE "client_uuid" IS NULL;--> statement-breakpoint
ALTER TABLE "pack_templates" ALTER COLUMN "client_uuid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_templates" ADD CONSTRAINT "pack_templates_client_uuid_unique" UNIQUE("client_uuid");--> statement-breakpoint
ALTER TABLE "pack_templates" ADD CONSTRAINT "pack_templates_client_uuid_format" CHECK ("client_uuid" ~ '^[A-Za-z0-9_-]{1,64}$');--> statement-breakpoint

-- weight_history
ALTER TABLE "weight_history" ADD COLUMN "client_uuid" text;--> statement-breakpoint
UPDATE "weight_history" SET "client_uuid" = "id" WHERE "client_uuid" IS NULL;--> statement-breakpoint
ALTER TABLE "weight_history" ALTER COLUMN "client_uuid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_client_uuid_unique" UNIQUE("client_uuid");--> statement-breakpoint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_client_uuid_format" CHECK ("client_uuid" ~ '^[A-Za-z0-9_-]{1,64}$');--> statement-breakpoint

-- packs
ALTER TABLE "packs" ADD COLUMN "client_uuid" text;--> statement-breakpoint
UPDATE "packs" SET "client_uuid" = "id" WHERE "client_uuid" IS NULL;--> statement-breakpoint
ALTER TABLE "packs" ALTER COLUMN "client_uuid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_client_uuid_unique" UNIQUE("client_uuid");--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_client_uuid_format" CHECK ("client_uuid" ~ '^[A-Za-z0-9_-]{1,64}$');--> statement-breakpoint

-- trail_condition_reports
ALTER TABLE "trail_condition_reports" ADD COLUMN "client_uuid" text;--> statement-breakpoint
UPDATE "trail_condition_reports" SET "client_uuid" = "id" WHERE "client_uuid" IS NULL;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ALTER COLUMN "client_uuid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD CONSTRAINT "trail_condition_reports_client_uuid_unique" UNIQUE("client_uuid");--> statement-breakpoint
ALTER TABLE "trail_condition_reports" ADD CONSTRAINT "trail_condition_reports_client_uuid_format" CHECK ("client_uuid" ~ '^[A-Za-z0-9_-]{1,64}$');--> statement-breakpoint

-- trips
ALTER TABLE "trips" ADD COLUMN "client_uuid" text;--> statement-breakpoint
UPDATE "trips" SET "client_uuid" = "id" WHERE "client_uuid" IS NULL;--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "client_uuid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_client_uuid_unique" UNIQUE("client_uuid");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_client_uuid_format" CHECK ("client_uuid" ~ '^[A-Za-z0-9_-]{1,64}$');
