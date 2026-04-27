import { packsStore } from 'app/features/packs/store';
import { obs } from 'app/lib/store';
import { nanoid } from 'nanoid';
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

    obs(packsStore, id).set(newPack);

    return id;
  }, []);

  return createPack;
}
