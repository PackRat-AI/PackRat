import type { PackInput, PackInStore } from '@packrat/app/packs';
import { packsStore } from '@packrat/app/packs/store';
import { obs } from 'expo-app/lib/store';
import { nanoid } from 'nanoid';
import { useCallback } from 'react';

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
