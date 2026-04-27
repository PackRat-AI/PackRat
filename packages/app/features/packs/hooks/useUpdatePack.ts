import { packsStore } from 'app/features/packs/store';
import { obs } from 'app/lib/store';
import { useCallback } from 'react';
import type { Pack } from '../types';

export function useUpdatePack() {
  const updatePack = useCallback((pack: Pack) => {
    obs(packsStore, pack.id).set({
      ...pack,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return updatePack;
}
