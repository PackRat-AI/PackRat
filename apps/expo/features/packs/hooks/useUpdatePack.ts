import { packsStore } from 'expo-app/features/packs/store';
import { useCallback } from 'react';
import type { Pack } from '../types';

export function useUpdatePack() {
  const updatePack = useCallback((pack: Pack) => {
    // @ts-ignore: Safe because Legend-State uses Proxy
    packsStore[pack.id].set({
      ...pack,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return updatePack;
}
