/**
 * Store-level pack-item write.
 *
 * Extracted from `useCreatePackItem` so non-React callers — the assistant's
 * `addItemToPack` tool — write through exactly the same path as a user tapping
 * "add item": local store first, outbox sync outward, pack weight history
 * recorded. Duplicating this logic is how an assistant-added item ends up
 * missing from weight totals or from the sync queue.
 *
 * The record itself is built by `buildNewPackItem`, which is pure and covered
 * by tests; this file is only the store effect around it.
 */

import { packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { recordPackWeight } from 'expo-app/features/packs/store/packWeightHistory';
import { obs } from 'expo-app/lib/store';
import { nanoid } from 'nanoid';
import type { PackItem, PackItemInput } from '../types';
import { buildNewPackItem } from './buildNewPackItem';

export function writePackItem({
  packId,
  itemData,
}: {
  packId: string;
  itemData: PackItemInput;
}): PackItem {
  const newItem = buildNewPackItem({ id: nanoid(), packId, itemData });

  obs({ store: packItemsStore, id: newItem.id }).set(newItem);
  obs({ store: packsStore, id: packId }).localUpdatedAt.set(new Date().toISOString());
  recordPackWeight(packId);

  return newItem;
}
