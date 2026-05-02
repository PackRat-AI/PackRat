import type { Pack } from '@packrat/app/packs';
import { packsStore } from '@packrat/app/packs/store';
import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';

export function useUpdatePack() {
  const updatePack = useCallback((pack: Pack) => {
    obs(packsStore, pack.id).set({
      ...pack,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return updatePack;
}
