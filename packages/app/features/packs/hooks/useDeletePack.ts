import { getPackItems, packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';

export function useDeletePack() {
  const deletePack = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    for (const item of getPackItems(id)) {
      obs(packItemsStore, item.id).deleted.set(true);
    }
    obs(packsStore, id).deleted.set(true);
  }, []);

  return deletePack;
}
