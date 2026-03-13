// useUpdatePackTemplateItem.ts

import { useCallback } from 'react';
import { packTemplateItemsStore, packTemplatesStore } from '../store';
import type { PackTemplateItem } from '../types';

export function useUpdatePackTemplateItem() {
  const updatePackTemplateItem = useCallback((item: PackTemplateItem) => {
    // @ts-expect-error: Safe because Legend-State uses Proxy
    packTemplateItemsStore[item.id].set(item);
    // @ts-expect-error: Safe because Legend-State uses Proxy
    packTemplatesStore[item.packTemplateId].localUpdatedAt.set(new Date().toISOString());
  }, []);

  return updatePackTemplateItem;
}
