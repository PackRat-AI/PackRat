// useUpdatePackTemplateItem.ts

import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';
import { packTemplateItemsStore, packTemplatesStore } from '../store';
import type { PackTemplateItem } from '../types';

export function useUpdatePackTemplateItem() {
  const updatePackTemplateItem = useCallback((item: PackTemplateItem) => {
    obs(packTemplateItemsStore, item.id).set(item);
    obs(packTemplatesStore, item.packTemplateId).localUpdatedAt.set(new Date().toISOString());
  }, []);

  return updatePackTemplateItem;
}
