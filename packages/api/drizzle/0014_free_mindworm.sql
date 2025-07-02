-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'catalog_items_sku_unique' 
        AND conrelid = 'catalog_items'::regclass
    ) THEN
        ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_sku_unique" UNIQUE("sku");
    END IF;
END $$;