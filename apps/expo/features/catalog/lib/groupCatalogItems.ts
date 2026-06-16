import type { CatalogItem } from '../types';

export type CatalogItemGroup = {
  key: string;
  representative: CatalogItem;
  variants: CatalogItem[];
};

function groupKey(item: CatalogItem): string {
  return `${(item.name ?? '').toLowerCase().trim()}:::${(item.brand ?? '').toLowerCase().trim()}`;
}

export function groupCatalogItems(items: CatalogItem[]): CatalogItemGroup[] {
  const map = new Map<string, CatalogItemGroup>();
  for (const item of items) {
    const key = groupKey(item);
    const group = map.get(key);
    if (group) {
      group.variants.push(item);
    } else {
      map.set(key, { key, representative: item, variants: [item] });
    }
  }
  return Array.from(map.values());
}
