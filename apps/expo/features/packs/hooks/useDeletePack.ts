import { getPackItems, packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { useCallback } from 'react';

export function useDeletePack() {
  const deletePack = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    // @ts-ignore: Safe because Legend-State uses Proxy
    getPackItems(id).forEach((item) => packItemsStore[item.id].deleted.set(true));
    packsStore[id].deleted.set(true);
  }, []);

  return deletePack;
}
