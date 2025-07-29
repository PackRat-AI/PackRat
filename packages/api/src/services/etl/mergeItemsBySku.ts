import type { NewCatalogItem } from '@packrat/api/db/schema';

/**
 * Merges all occurrences of each SKU into a single item
 * Later occurrences override earlier ones for non-null values
 */
export function mergeItemsBySku(items: NewCatalogItem[]): NewCatalogItem[] {
  const merged: Record<string, NewCatalogItem> = {};

  for (const item of items) {
    // We're checking sku presence during validation already, but...
    if (!item.sku?.trim()) {
      continue;
    }

    const sku = item.sku.trim();

    if (!merged[sku]) {
      // First occurrence - use as base
      merged[sku] = { ...item };
    } else {
      // Merge with existing - non-null values from current item override
      const before = { ...merged[sku] };

      merged[sku] = {
        ...merged[sku],
        ...Object.fromEntries(
          Object.entries(item).filter(
            ([_key, value]) => value !== null && value !== undefined && value !== '',
          ),
        ),
      };

      // Log what changed
      const changes = Object.entries(item)
        .filter(
          ([key, value]) =>
            value !== null &&
            value !== undefined &&
            value !== '' &&
            before[key as keyof NewCatalogItem] !== value,
        )
        .map(([key, value]) => `${key}: ${before[key as keyof NewCatalogItem]} → ${value}`);

      if (changes.length > 0) {
        console.log(`🔄 Merged SKU "${sku}": ${changes.join(', ')}`);
      }
    }
  }

  return Object.values(merged);
}
