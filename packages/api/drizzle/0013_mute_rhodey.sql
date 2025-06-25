ALTER TABLE "catalog_items" DROP CONSTRAINT "catalog_items_sku_unique";--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "pack_items" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "embedding_idx" ON "catalog_items" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "pack_items_embedding_idx" ON "pack_items" USING hnsw ("embedding" vector_cosine_ops);