// useCreatePackTemplateItem.ts

import { obs } from 'expo-app/lib/store';
import { nanoid } from 'nanoid';
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

      obs({ store: packTemplateItemsStore, id: id }).set(newItem);
      obs({ store: packTemplatesStore, id: packTemplateId }).localUpdatedAt.set(
        new Date().toISOString(),
      );
    },
    [],
  );

  return createPackTemplateItem;
}
