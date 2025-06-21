import { useCallback } from 'react';
import { packsStore } from '~/features/packs/store';

export function useDeletePack() {
  const deletePack = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    packsStore[id].deleted.set(true);
  }, []);

  return deletePack;
}
