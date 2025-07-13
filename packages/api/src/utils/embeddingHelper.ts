import type { CatalogItem, PackItem } from '../db/schema';

type ItemForEmbedding = Partial<CatalogItem> | Partial<PackItem>;

export const getEmbeddingText = (
  item: ItemForEmbedding,
  existingItem?: Partial<CatalogItem> | Partial<PackItem>,
): string => {
  const name = item.name || existingItem?.name || '';
  const description = item.description || existingItem?.description || '';
  const category = item.category || existingItem?.category || '';

  // Catalog-item specific field
  const brand =
    'brand' in item && item.brand
      ? item.brand
      : (existingItem && 'brand' in existingItem ? existingItem.brand : '') || '';

  return `${name} ${description} ${category} ${brand}`.trim().replace(/\s+/g, ' ');
};
