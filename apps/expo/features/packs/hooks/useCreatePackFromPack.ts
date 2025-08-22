import { packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { recordPackWeight } from 'expo-app/features/packs/store/packWeightHistory';
import type { Pack, PackInput, PackInStore } from 'expo-app/features/packs/types';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';

export function useCreatePackFromPack() {
  const createPackFromPack = useCallback((sourcePack: Pack, packData: Partial<PackInput>) => {
    const newPackId = nanoid();
    const timestamp = new Date().toISOString();

    // Create the new pack with custom data, falling back to source pack data
    const newPack: PackInStore = {
      id: newPackId,
      name: packData.name || `${sourcePack.name} (Copy)`,
      description: packData.description || sourcePack.description,
      category: packData.category || sourcePack.category,
      isPublic: packData.isPublic !== undefined ? packData.isPublic : false, // Default to private
      image: packData.image !== undefined ? packData.image : sourcePack.image,
      tags: packData.tags || sourcePack.tags || [],
      localCreatedAt: timestamp,
      localUpdatedAt: timestamp,
      deleted: false,
    };

    // @ts-ignore: Safe because Legend-State uses Proxy
    packsStore[newPackId].set(newPack);

    // Copy each item from the source pack
    if (sourcePack.items) {
      for (const item of sourcePack.items) {
        if (!item.deleted) {
          const newItemId = nanoid();
          const newItem = {
            ...item,
            id: newItemId,
            packId: newPackId,
            deleted: false,
            createdAt: undefined, // Reset server timestamps
            updatedAt: undefined,
          };

          // @ts-ignore: Safe because Legend-State uses Proxy
          packItemsStore[newItemId].set(newItem);
        }
      }
    }

    // Recalculate pack weight
    recordPackWeight(newPackId);

    return newPackId;
  }, []);

  return createPackFromPack;
}
