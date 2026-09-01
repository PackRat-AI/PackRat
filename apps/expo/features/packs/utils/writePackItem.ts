/**
 * Store-level pack-item write.
 *
 * Extracted from `useCreatePackItem` so non-React callers — the assistant's
 * on-device `addItemToPack` tool — write through exactly the same path as a
 * user tapping "add item": local store first, outbox sync outward, pack weight
 * history recorded. Duplicating this logic is how an assistant-added item ends
 * up missing from weight totals or from the sync queue.
 */

import { packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { recordPackWeight } from 'expo-app/features/packs/store/packWeightHistory';
import { obs } from 'expo-app/lib/store';
import { nanoid } from 'nanoid';
import type { PackItem, PackItemInput } from '../types';

export function writePackItem({
  packId,
  itemData,
}: {
  packId: string;
  itemData: PackItemInput;
}): PackItem {
  const id = nanoid();

  const newItem: PackItem = {
    id,
    name: itemData.name,
    description: itemData.description ?? undefined,
    weight: itemData.weight,
    weightUnit: itemData.weightUnit,
    quantity: itemData.quantity,
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

  obs({ store: packItemsStore, id }).set(newItem);
  obs({ store: packsStore, id: packId }).localUpdatedAt.set(new Date().toISOString());
  recordPackWeight(packId);

  return newItem;
}
