// hooks/useCreatePackFromTemplate.ts

import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import { packTemplateItemsStore } from '~/features/pack-templates/store';
import { packItemsStore, packsStore } from '~/features/packs/store';
import { recordPackWeight } from '~/features/packs/store/packWeightHistory';
import type { PackInput, PackInStore } from '~/features/packs/types';

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
      const newItemId = nanoid();
      const newItem = {
        ...item,
        id: newItemId,
        packId: newPackId,
        deleted: false,
      };
      delete (newItem as any).packTemplateId;
      packItemsStore[newItemId].set(newItem);
    }

    // Recalculate pack weight
    recordPackWeight(newPackId);

    return newPackId;
  }, []);

  return createPackFromTemplate;
}
