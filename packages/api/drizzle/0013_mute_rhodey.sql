DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'catalog_items_sku_unique' 
        AND table_name = 'catalog_items'
    ) THEN
        ALTER TABLE "catalog_items" DROP CONSTRAINT "catalog_items_sku_unique";
    END IF;
END $$;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "pack_items" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "embedding_idx" ON "catalog_items" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "pack_items_embedding_idx" ON "pack_items" USING hnsw ("embedding" vector_cosine_ops);