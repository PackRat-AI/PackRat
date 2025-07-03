import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import { packItemsStore, packsStore } from '~/features/packs/store';
import { recordPackWeight } from '../store/packWeightHistory';
import type { PackItem, PackItemInput } from '../types';

export function useCreatePackItem() {
  const createPackItem = useCallback(
    ({ packId, itemData }: { packId: string; itemData: PackItemInput }) => {
      const id = nanoid();

      const newItem: PackItem = {
        id,
        ...itemData,
        packId,
        deleted: false,
      };

      packItemsStore[id].set(newItem);
      packsStore[packId].localUpdatedAt.set(new Date().toISOString());
      recordPackWeight(packId);
    },
    [],
  );

  return createPackItem;
}
