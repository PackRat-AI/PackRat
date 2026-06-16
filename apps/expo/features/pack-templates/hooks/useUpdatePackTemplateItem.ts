// useUpdatePackTemplateItem.ts

import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';
import { packTemplateItemsStore, packTemplatesStore } from '../store';
import type { PackTemplateItem } from '../types';

export function useUpdatePackTemplateItem() {
  const updatePackTemplateItem = useCallback((item: PackTemplateItem) => {
    obs({ store: packTemplateItemsStore, id: item.id }).set(item);
    obs({ store: packTemplatesStore, id: item.packTemplateId }).localUpdatedAt.set(
      new Date().toISOString(),
    );
  }, []);

  return updatePackTemplateItem;
}
