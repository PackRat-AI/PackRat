import { packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { obs } from 'expo-app/lib/store';
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
        name: itemData.name,
        description: itemData.description,
        weight: itemData.weight,
        weightUnit: itemData.weightUnit,
        quantity: itemData.quantity,
        category: itemData.category || 'general',
        consumable: itemData.consumable,
        worn: itemData.worn,
        notes: itemData.notes,
        image: itemData.image,
        catalogItemId: itemData.catalogItemId,
        packId,
        isAIGenerated: false,
        deleted: false,
      };

      obs(packItemsStore, id).set(newItem);
      obs(packsStore, packId).localUpdatedAt.set(new Date().toISOString());
      recordPackWeight(packId);
    },
    [],
  );

  return createPackItem;
}
