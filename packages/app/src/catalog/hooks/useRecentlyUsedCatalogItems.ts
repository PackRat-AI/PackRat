import {
  buildUpdatedRecentlyUsed,
  recentlyUsedCatalogItemsAtom,
} from '@packrat/app/atoms/recentlyUsedCatalogItemsAtom';
import type { CatalogItem } from '@packrat/app/catalog';
import { useAtom } from 'jotai';
import { useCallback } from 'react';

export function useRecentlyUsedCatalogItems() {
  const [recentItems, setRecentItems] = useAtom(recentlyUsedCatalogItemsAtom);

  const trackRecentlyUsed = useCallback(
    (items: CatalogItem[]) => {
      setRecentItems((current: CatalogItem[]) => buildUpdatedRecentlyUsed(current, items));
    },
    [setRecentItems],
  );

  return { recentItems, trackRecentlyUsed };
}
