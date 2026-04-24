import * as Burnt from 'burnt';
import { fromZod } from '@packrat/guards';
import { WeightUnitSchema } from '@packrat/api/types';
import { cacheCatalogItemImage } from 'expo-app/features/catalog/lib/cacheCatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useState } from 'react';
import type { PackItem } from '../types';
import { useCreatePackItem } from './useCreatePackItem';

export function useAddCatalogItem() {
  const [isLoading, setIsLoading] = useState(false);
  const createItem = useCreatePackItem();

  const addItemToPack = async (
    packId: string,
    opts: { catalogItem: CatalogItem; data?: Partial<PackItem> },
  ) => {
    const { catalogItem, data } = opts;
    setIsLoading(true);
    const cachedImageFilename = await cacheCatalogItemImage(catalogItem.images?.[0]);

    // Create the pack item with default values
    createItem({
      packId,
      itemData: {
        name: catalogItem.name,
        description: catalogItem.description ?? undefined,
        weight: catalogItem.weight || 0,
        weightUnit: fromZod(WeightUnitSchema)(catalogItem.weightUnit) ?? 'g',
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
