import { obs } from '@packrat/app/lib/store';
import type { PackItem, PackItemInput } from '@packrat/app/packs';
import { packItemsStore, packsStore } from '@packrat/app/packs/store';
import { nanoid } from 'nanoid';
import { useCallback } from 'react';
import { recordPackWeight } from '../store/packWeightHistory';

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
