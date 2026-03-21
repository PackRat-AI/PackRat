// hooks/useCreatePackFromTemplate.ts

import { getTemplateItems } from 'expo-app/features/pack-templates/store';
import { useCreatePack, useCreatePackItem } from 'expo-app/features/packs';
import type { PackInput } from 'expo-app/features/packs/types';
import { useCallback } from 'react';

export function useCreatePackFromTemplate() {
  const createPack = useCreatePack();
  const createPackItem = useCreatePackItem();

  const createPackFromTemplate = useCallback(
    (packTemplateId: string, packData: PackInput) => {
      const packId = createPack(packData);

      const templateItems = getTemplateItems(packTemplateId);

      for (const itemData of templateItems) {
        createPackItem({
          packId,
          itemData,
        });
      }

      return packId;
    },
    [createPack, createPackItem],
  );

  return createPackFromTemplate;
}
