import {
  buildUpdatedRecentlyUsed,
  recentlyUsedCatalogItemsAtom,
} from 'expo-app/atoms/recentlyUsedCatalogItemsAtom';
import { useAtom } from 'jotai';
import { useCallback } from 'react';
import type { CatalogItem } from '../types';

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
