import { packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { useCallback } from 'react';
import type { PackItem, PackItemInput } from '../types';
import { nanoid } from 'nanoid/non-secure';
import { recordPackWeight } from '../store/packWeightHistory';

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
