import type { PackItem } from '@packrat/app/packs';
import { packItemsStore, packsStore } from '@packrat/app/packs/store';
import { useCallback } from 'react';
import { recordPackWeight } from '../store/packWeightHistory';

export function useUpdatePackItem() {
  const updatePackItem = useCallback((item: PackItem) => {
    const prevItem = packItemsStore[item.id]?.peek();
    packItemsStore[item.id]?.set(item);
    packsStore[item.packId]?.localUpdatedAt?.set(new Date().toISOString());

    // only record weight when it's changed
    if (prevItem && (prevItem.weight !== item.weight || prevItem.weightUnit !== item.weightUnit))
      recordPackWeight(item.packId);
  }, []);

  return updatePackItem;
}
