-- Step 1: Alter id column type
ALTER TABLE "weight_history" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint

-- Step 2: Add columns without NOT NULL constraint first
ALTER TABLE "weight_history" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "weight_history" ADD COLUMN "local_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "local_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "local_updated_at" timestamp;--> statement-breakpoint

-- Step 3: Update existing rows with appropriate values
-- For weight_history, set user_id from the associated pack
UPDATE "weight_history" 
SET "user_id" = "packs"."user_id" 
FROM "packs" 
WHERE "weight_history"."pack_id" = "packs"."id";--> statement-breakpoint

-- Set local_created_at to the current created_at value
UPDATE "weight_history" SET "local_created_at" = "created_at";--> statement-breakpoint
UPDATE "packs" SET "local_created_at" = "created_at", "local_updated_at" = "updated_at";--> statement-breakpoint

-- Step 4: Now add the NOT NULL constraints
ALTER TABLE "weight_history" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "weight_history" ALTER COLUMN "local_created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ALTER COLUMN "local_created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ALTER COLUMN "local_updated_at" SET NOT NULL;--> statement-breakpoint

-- Step 5: Add the foreign key constraint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;