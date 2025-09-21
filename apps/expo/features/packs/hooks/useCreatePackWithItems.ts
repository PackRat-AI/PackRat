import { useCallback } from 'react';
import type { PackInput, PackItemInput } from '../types';
import { useCreatePack } from './useCreatePack';
import { useCreatePackItem } from './useCreatePackItem';

export interface CreatePackWithItemsInput extends PackInput {
  items?: PackItemInput[];
}

// Hook to create a pack with items
export function useCreatePackWithItems() {
  const createPack = useCreatePack();
  const createPackItem = useCreatePackItem();

  const createPackWithItems = useCallback(
    (packData: CreatePackWithItemsInput) => {
      const { items, ...packInfo } = packData;
      const id = createPack(packInfo);

      if (items && items.length > 0) {
        items.forEach((item) => {
          createPackItem({
            packId: id,
            itemData: item,
          });
        });
      }

      return id;
    },
    [createPack, createPackItem],
  );

  return createPackWithItems;
}
