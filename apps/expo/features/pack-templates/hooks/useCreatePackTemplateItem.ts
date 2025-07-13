// useCreatePackTemplateItem.ts

import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import { packTemplateItemsStore } from '../store/packTemplateItems';
import { packTemplatesStore } from '../store/packTemplates';
import type { PackTemplateItem, PackTemplateItemInput } from '../types';

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
      packTemplateItemsStore[id].set(newItem);
      packTemplatesStore[packTemplateId].localUpdatedAt.set(new Date().toISOString());
    },
    [],
  );

  return createPackTemplateItem;
}
