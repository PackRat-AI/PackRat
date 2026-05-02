// hooks/useCreatePackFromTemplate.ts

import { getTemplateItems } from '@packrat/app/pack-templates/store';
import type { PackInput } from '@packrat/app/packs';
import { useCreatePack } from '@packrat/app/packs/hooks/useCreatePack';
import { useCreatePackItem } from '@packrat/app/packs/hooks/useCreatePackItem';
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
