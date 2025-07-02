ALTER TABLE "pack_items" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "pack_items" ADD COLUMN "deleted" boolean DEFAULT false;