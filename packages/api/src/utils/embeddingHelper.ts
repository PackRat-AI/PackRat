import type { CatalogItem, PackItem } from '../db/schema';

type ItemForEmbedding = Partial<CatalogItem> | Partial<PackItem>;

export const getEmbeddingText = (
  item: ItemForEmbedding,
  existingItem?: Partial<CatalogItem> | Partial<PackItem>,
): string => {
  const name = item.name || existingItem?.name || '';
  const description = item.description || existingItem?.description || '';
  const category =
    'category' in item
      ? item.category
      : existingItem && 'category' in existingItem
        ? existingItem.category
        : '';
  const categories =
    'categories' in item
      ? item.categories?.join(', ')
      : existingItem && 'categories' in existingItem
        ? existingItem.categories?.join(' ')
        : '';
  const brand =
    'brand' in item && item.brand
      ? item.brand
      : (existingItem && 'brand' in existingItem ? existingItem.brand : '') || '';

  return `${name} ${description} ${category} ${categories} ${brand}`.trim().replace(/\s+/g, ' ');
};
