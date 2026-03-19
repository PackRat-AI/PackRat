import { useCallback } from 'react';
import { packTemplateItemsStore } from '../store/packTemplateItems';

export function useDeletePackTemplateItem() {
  const deletePackTemplateItem = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    // @ts-expect-error: Safe because Legend-State uses Proxy
    packTemplateItemsStore[id].deleted.set(true);

    return Promise.resolve({ id });
  }, []);

  return deletePackTemplateItem;
}
