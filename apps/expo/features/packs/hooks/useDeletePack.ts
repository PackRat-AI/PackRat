import { getPackItems, packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { useCallback } from 'react';

export function useDeletePack() {
  const deletePack = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    for (const item of getPackItems(id)) {
      // @ts-expect-error: Safe because Legend-State uses Proxy
      packItemsStore[item.id].deleted.set(true);
    }
    // @ts-expect-error: Safe because Legend-State uses Proxy
    packsStore[id].deleted.set(true);
  }, []);

  return deletePack;
}
