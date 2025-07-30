import { packsStore } from 'expo-app/features/packs/store';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import type { PackInput, PackInStore } from '../types';

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

    // @ts-ignore: Safe because Legend-State uses Proxy
    packsStore[id].set(newPack);
  }, []);

  return createPack;
}
