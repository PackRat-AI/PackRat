import { obs } from 'app/lib/store';
import { useCallback } from 'react';
import { packTemplateItemsStore } from '../store/packTemplateItems';

export function useDeletePackTemplateItem() {
  const deletePackTemplateItem = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    obs(packTemplateItemsStore, id).deleted.set(true);

    return Promise.resolve({ id });
  }, []);

  return deletePackTemplateItem;
}
