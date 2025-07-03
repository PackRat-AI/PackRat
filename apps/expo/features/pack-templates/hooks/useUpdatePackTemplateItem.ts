// useUpdatePackTemplateItem.ts

import { useCallback } from 'react';
import { packTemplateItemsStore, packTemplatesStore } from '../store';
import type { PackTemplateItem } from '../types';

export function useUpdatePackTemplateItem() {
  const updatePackTemplateItem = useCallback((item: PackTemplateItem) => {
    packTemplateItemsStore[item.id].set(item);
    packTemplatesStore[item.packTemplateId].localUpdatedAt.set(new Date().toISOString());
  }, []);

  return updatePackTemplateItem;
}
