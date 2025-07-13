// hooks/useCreatePackFromTemplate.ts

import { packTemplateItemsStore } from 'expo-app/features/pack-templates/store';
import { packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { recordPackWeight } from 'expo-app/features/packs/store/packWeightHistory';
import type { PackInput, PackInStore } from 'expo-app/features/packs/types';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';

export function useCreatePackFromTemplate() {
  const createPackFromTemplate = useCallback((packTemplateId: string, packData: PackInput) => {
    const newPackId = nanoid();
    const timestamp = new Date().toISOString();

    // Create the new pack
    const newPack: PackInStore = {
      id: newPackId,
      ...packData,
      localCreatedAt: timestamp,
      localUpdatedAt: timestamp,
      deleted: false,
    };

    packsStore[newPackId].set(newPack);

    // Copy each item
    const allTemplateItems = Object.values(packTemplateItemsStore).map((item) => item.get());
    const templateItems = allTemplateItems.filter(
      (item) => item.packTemplateId === packTemplateId && !item.deleted,
    );

    for (const item of templateItems) {
      // biome-ignore lint/correctness/noUnusedVariables: aim is to remove `packTemplateId`
      const { packTemplateId, ...restItem } = item;
      const newItemId = nanoid();
      const newItem = {
        ...restItem,
        id: newItemId,
        packId: newPackId,
        deleted: false,
      };

      packItemsStore[newItemId].set(newItem);
    }

    // Recalculate pack weight
    recordPackWeight(newPackId);

    return newPackId;
  }, []);

  return createPackFromTemplate;
}
