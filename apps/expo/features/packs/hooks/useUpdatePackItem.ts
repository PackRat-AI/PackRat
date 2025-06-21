import { packItemsStore, packsStore } from '~/features/packs/store';
import { useCallback } from 'react';
import type { PackItem } from '../types';
import { recordPackWeight } from '../store/packWeightHistory';

export function useUpdatePackItem() {
  const updatePackItem = useCallback((item: PackItem) => {
    const prevItem = packItemsStore[item.id].peek();
    packItemsStore[item.id].set(item);
    packsStore[item.packId].localUpdatedAt.set(new Date().toISOString());

    // only record weight when it's changed
    if (prevItem.weight !== item.weight || prevItem.weightUnit !== item.weightUnit)
      recordPackWeight(item.packId);
  }, []);

  return updatePackItem;
}
