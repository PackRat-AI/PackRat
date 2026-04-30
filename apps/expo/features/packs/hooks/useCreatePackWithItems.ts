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
        // Delay item writes until the pack is likely committed on the server.
        // Both stores sync in parallel; without a delay, items arrive before
        // the pack row exists and trigger FK violations (the retry mechanism
        // recovers, but this prevents the noise). Items appear immediately
        // in the UI via optimistic store writes, so no visible delay.
        setTimeout(() => {
          for (const item of items) {
            createPackItem({
              packId: id,
              itemData: item,
            });
          }
        }, 1500);
      }

      return id;
    },
    [createPack, createPackItem],
  );

  return createPackWithItems;
}
