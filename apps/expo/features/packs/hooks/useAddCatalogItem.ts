import * as Burnt from 'burnt';
import { cacheCatalogItemImage } from 'expo-app/features/catalog/lib/cacheCatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useState } from 'react';
import type { PackItem, WeightUnit } from '../types';
import { useCreatePackItem } from './useCreatePackItem';

export function useAddCatalogItem() {
  const [isLoading, setIsLoading] = useState(false);
  const createItem = useCreatePackItem();

  // biome-ignore lint/complexity/useMaxParams: existing code - migrate to single typed object parameter
  const addItemToPack = async (
    packId: string,
    catalogItem: CatalogItem,
    data?: Partial<PackItem>,
  ) => {
    setIsLoading(true);
    const cachedImageFilename = await cacheCatalogItemImage(catalogItem.images?.[0]);

    // Create the pack item with default values
    createItem({
      packId,
      itemData: {
        name: catalogItem.name,
        description: catalogItem.description ?? undefined,
        weight: catalogItem.weight || 0,
        weightUnit: (catalogItem.weightUnit ?? 'g') as WeightUnit,
        quantity: 1, // Default quantity
        category: '', // Let user categorize later if needed
        consumable: false, // Default to non-consumable
        worn: false, // Default to not worn
        notes: '', // No default notes
        image: cachedImageFilename,
        catalogItemId: catalogItem.id,
        ...data,
      },
    });

    Burnt.toast({
      title: 'Item added to pack',
      preset: 'done',
    });

    setIsLoading(false);
  };

  return { addItemToPack, isLoading };
}
