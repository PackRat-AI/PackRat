import { use$ } from '@legendapp/state/react';
import { useUserPackItems } from './useUserPackItems';

export function useHasMinimumInventory(minimumItems: number = 20) {
  const items = useUserPackItems();

  const hasMinimumItems = use$(() => {
    return items.length >= minimumItems;
  });

  return {
    hasMinimumItems,
    currentItemCount: items.length,
    minimumRequired: minimumItems,
  };
}
