import { packItemsStore } from 'app/features/packs/store';
import { obs } from 'app/lib/store';
import { useCallback } from 'react';

export function useDeletePackItem() {
  const deletePackItem = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    obs(packItemsStore, id).deleted.set(true);

    return Promise.resolve({ id });
  }, []);

  return deletePackItem;
}
