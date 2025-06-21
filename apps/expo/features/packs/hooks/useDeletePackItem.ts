import { useCallback } from 'react';
import { packItemsStore } from '~/features/packs/store';

export function useDeletePackItem() {
  const deletePackItem = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    packItemsStore[id].deleted.set(true);

    return Promise.resolve({ id });
  }, []);

  return deletePackItem;
}
