import { packsStore } from 'expo-app/features/packs/store';
import { useCallback } from 'react';

export function useDeletePack() {
  const deletePack = useCallback((id: string) => {
    // Soft delete by setting deleted flag
    // @ts-ignore: Safe because Legend-State uses Proxy
    packsStore[id].deleted.set(true);
  }, []);

  return deletePack;
}
