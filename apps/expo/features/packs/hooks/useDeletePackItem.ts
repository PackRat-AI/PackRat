import { packItemsStore } from 'expo-app/features/packs/store';
import { useCallback } from 'react';

export function useDeletePackItem() {
  const deletePackItem = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    // @ts-expect-error: Safe because Legend-State uses Proxy
    packItemsStore[id].deleted.set(true);

    return Promise.resolve({ id });
  }, []);

  return deletePackItem;
}
