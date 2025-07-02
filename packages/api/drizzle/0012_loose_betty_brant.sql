DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'catalog_items_sku_unique' 
        AND table_name = 'catalog_items'
    ) THEN
        ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_sku_unique" UNIQUE("sku");
    END IF;
END $$;