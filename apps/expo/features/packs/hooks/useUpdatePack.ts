import { useCallback } from 'react';
import { packsStore } from '~/features/packs/store';
import type { Pack } from '../types';

export function useUpdatePack() {
  const updatePack = useCallback((pack: Pack) => {
    packsStore[pack.id].set({ ...pack, localUpdatedAt: new Date().toISOString() });
  }, []);

  return updatePack;
}
