-- First delete from pack_items where catalog_item has NULL sku
DELETE FROM pack_items 
WHERE catalog_item_id IN (
  SELECT id FROM catalog_items WHERE sku IS NULL
);--> statement-breakpoint

-- Then delete the catalog_items with NULL sku
DELETE FROM catalog_items 
WHERE sku IS NULL;--> statement-breakpoint

-- Finally alter the column to NOT NULL
ALTER TABLE "catalog_items" ALTER COLUMN "sku" SET NOT NULL;