import type { CatalogItem } from 'app/features/catalog/types';
import { atomWithAsyncStorage } from './atomWithAsyncStorage';

const MAX_RECENTLY_USED = 10;

export const recentlyUsedCatalogItemsAtom = atomWithAsyncStorage<CatalogItem[]>(
  'recentlyUsedCatalogItems',
  [],
);

export function buildUpdatedRecentlyUsed(
  current: CatalogItem[],
  added: CatalogItem[],
): CatalogItem[] {
  const addedIds = new Set(added.map((item) => item.id));
  const merged = [...added, ...current.filter((item) => !addedIds.has(item.id))];
  return merged.slice(0, MAX_RECENTLY_USED);
}
