import { packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import { recordPackWeight } from '../store/packWeightHistory';
import type { PackItem, PackItemInput } from '../types';

export function useCreatePackItem() {
  const createPackItem = useCallback(
    ({ packId, itemData }: { packId: string; itemData: PackItemInput }) => {
      const id = nanoid();

      const newItem: PackItem = {
        id,
        ...itemData,
        category: itemData.category || 'general',
        packId,
        deleted: false,
      };

      // @ts-ignore: Safe because Legend-State uses Proxy
      packItemsStore[id].set(newItem);
      // @ts-ignore: Safe because Legend-State uses Proxy
      packsStore[packId].localUpdatedAt.set(new Date().toISOString());
      recordPackWeight(packId);
    },
    [],
  );

  return createPackItem;
}
