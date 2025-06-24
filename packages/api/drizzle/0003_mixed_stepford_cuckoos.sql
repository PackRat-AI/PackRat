ALTER TABLE "pack_items" DROP CONSTRAINT IF EXISTS "pack_items_pack_id_packs_id_fk";-- Drop foreign key constraint first because we are changing the data type of the column
--> statement-breakpoint
ALTER TABLE "pack_items" ALTER COLUMN "pack_id" SET DATA TYPE text USING pack_id::text;-- Convert the column to text
--> statement-breakpoint
ALTER TABLE "packs" ALTER COLUMN "id" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE;-- Add the foreign key constraint back