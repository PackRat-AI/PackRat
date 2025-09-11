import { packsStore } from 'expo-app/features/packs/store';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import type { PackInput, PackInStore } from '../types';
import { useCreatePackItem } from './useCreatePackItem';
import type { PackSuggestionItem } from './useSeasonSuggestions';

export interface CreatePackWithItemsInput extends PackInput {
  items?: PackSuggestionItem[];
}

// Hook to create a pack with items
export function useCreatePackWithItems() {
  const createPackItem = useCreatePackItem();

  const createPackWithItems = useCallback(
    (packData: CreatePackWithItemsInput) => {
      const id = nanoid();
      const timestamp = new Date().toISOString();

      const newPack: PackInStore = {
        id,
        name: packData.name,
        description: packData.description,
        category: packData.category as any,
        templateId: packData.templateId,
        isPublic: packData.isPublic || false,
        image: packData.image,
        tags: packData.tags,
        localCreatedAt: timestamp,
        localUpdatedAt: timestamp,
        deleted: false,
      };

      // @ts-ignore: Safe because Legend-State uses Proxy
      packsStore[id].set(newPack);

      // Add items if provided
      if (packData.items && packData.items.length > 0) {
        packData.items.forEach((item) => {
          // Create pack item from the suggested item
          // Note: This assumes the item.id corresponds to a catalog item
          // In a real implementation, you'd need to map pack items to catalog items
          createPackItem({
            packId: id,
            itemData: {
              name: item.name,
              weight: 0, // Default weight - should be fetched from catalog
              weightUnit: 'g',
              quantity: item.quantity,
              category: 'general',
              consumable: false,
              worn: false,
              catalogItemId: item.id,
            },
          });
        });
      }

      return id;
    },
    [createPackItem],
  );

  return createPackWithItems;
}