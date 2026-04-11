ALTER TABLE "pack_items" ADD COLUMN "is_ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "is_ai_generated" boolean DEFAULT false NOT NULL;