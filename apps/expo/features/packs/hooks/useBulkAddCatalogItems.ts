import type { WeightUnit } from 'expo-app/types';
import { useState } from 'react';
import Toast from 'react-native-toast-message';
import { cacheCatalogItemImage } from '../../catalog/lib/cacheCatalogItemImage';
import type { CatalogItemWithPackItemFields } from '../../catalog/types';
import { useCreatePackItem } from './useCreatePackItem';

export function useBulkAddCatalogItems() {
  const [isLoading, setIsLoading] = useState(false);
  const createItem = useCreatePackItem();

  const addItemsToPack = async (packId: string, catalogItems: CatalogItemWithPackItemFields[]) => {
    if (catalogItems.length === 0) return;

    setIsLoading(true);

    try {
      // Add items sequentially
      for (const catalogItem of catalogItems) {
        // Cache the image if it exists
        const cachedImageFilename = await cacheCatalogItemImage(catalogItem.images?.[0]);

        // Create the pack item with default values
        createItem({
          packId,
          itemData: {
            name: catalogItem.name,
            description: catalogItem.description ?? undefined,
            weight: catalogItem.weight || 0,
            weightUnit: (catalogItem.weightUnit ?? 'g') as WeightUnit,
            quantity: catalogItem.quantity || 1,
            category: catalogItem.category || '',
            consumable: catalogItem.consumable || false,
            worn: catalogItem.worn || false,
            notes: catalogItem.notes || '',
            image: cachedImageFilename,
            catalogItemId: catalogItem.id,
          },
        });
      }

      const itemCount = catalogItems.length;
      Toast.show({
        type: 'success',
        text1: `${itemCount} ${itemCount === 1 ? 'item' : 'items'} added to pack`,
        text2: itemCount > 1 ? 'You can edit individual items as needed' : undefined,
      });
    } catch (error) {
      console.error('Error adding items to pack:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to add items',
        text2: 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    addItemsToPack,
    isLoading,
  };
}
