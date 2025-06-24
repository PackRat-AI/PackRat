ALTER TABLE "catalog_items" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "embeddingIndex" ON "catalog_items" USING hnsw ("embedding" vector_cosine_ops);