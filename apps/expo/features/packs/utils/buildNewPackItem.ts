/**
 * Builds the `PackItem` record written to the local store.
 *
 * Pure and separate from `writePackItem` so the defaulting rules — the ones
 * that decide what an assistant-added item actually looks like in the pack —
 * are unit testable without a Legend-State store.
 */

import type { PackItem, PackItemInput } from '../types';

export function buildNewPackItem({
  id,
  packId,
  itemData,
}: {
  id: string;
  packId: string;
  itemData: PackItemInput;
}): PackItem {
  return {
    id,
    name: itemData.name,
    description: itemData.description ?? undefined,
    weight: itemData.weight,
    weightUnit: itemData.weightUnit,
    quantity: itemData.quantity,
    // An empty category would render as a blank group header in the pack list.
    category: itemData.category || 'general',
    consumable: itemData.consumable,
    worn: itemData.worn,
    notes: itemData.notes,
    image: itemData.image,
    catalogItemId: itemData.catalogItemId,
    packId,
    isAIGenerated: false,
    deleted: false,
  };
}
