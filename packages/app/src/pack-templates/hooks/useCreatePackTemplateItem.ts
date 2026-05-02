// useCreatePackTemplateItem.ts

import { obs } from '@packrat/app/lib/store';
import type { PackTemplateItem, PackTemplateItemInput } from '@packrat/app/pack-templates';
import { nanoid } from 'nanoid';
import { useCallback } from 'react';
import { packTemplateItemsStore } from '../store/packTemplateItems';
import { packTemplatesStore } from '../store/packTemplates';

export function useCreatePackTemplateItem() {
  const createPackTemplateItem = useCallback(
    ({ packTemplateId, itemData }: { packTemplateId: string; itemData: PackTemplateItemInput }) => {
      const id = nanoid();

      const newItem: PackTemplateItem = {
        id,
        ...itemData,
        packTemplateId,
        deleted: false,
      };

      obs(packTemplateItemsStore, id).set(newItem);
      obs(packTemplatesStore, packTemplateId).localUpdatedAt.set(new Date().toISOString());
    },
    [],
  );

  return createPackTemplateItem;
}
