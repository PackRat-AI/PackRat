import { packsStore } from '~/features/packs/store';
import { useCallback } from 'react';
import type { PackInput, PackInStore } from '../types';
import { nanoid } from 'nanoid/non-secure';

// Hook to create a pack
export function useCreatePack() {
  const createPack = useCallback((packData: PackInput) => {
    const id = nanoid();
    const timestamp = new Date().toISOString();

    const newPack: PackInStore = {
      id,
      ...packData,
      localCreatedAt: timestamp,
      localUpdatedAt: timestamp,
      deleted: false,
    };

    packsStore[id].set(newPack);
  }, []);

  return createPack;
}
