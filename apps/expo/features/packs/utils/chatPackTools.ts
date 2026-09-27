/**
 * Client-side implementations of the assistant's pack tools.
 *
 * `listUserPacks` and `addItemToPack` are declared on the server with no
 * `execute` (packages/api/src/utils/ai/tools.ts), so the model's call is
 * streamed to the client and answered from the local store. That keeps reads
 * consistent with what the user is looking at and keeps writes on the offline
 * path — but it means every client MUST answer both tools. A client that
 * ignores one leaves the tool call unresolved and the turn stalls forever.
 *
 * These helpers hold the shared logic so the remote chat screen and the
 * on-device toolset cannot drift apart.
 */

import type { PackInStore, PackItem, PackItemInput, WeightUnit } from '../types';
import { matchPacksByName, type PackMatchSummary } from './matchPacksByName';

export type ListUserPacksInput = { nameQuery?: string | null };

export type AddItemToPackInput = {
  packId: string;
  name: string;
  weight?: number;
  weightUnit?: WeightUnit;
  quantity?: number;
  category?: string;
  consumable?: boolean;
  worn?: boolean;
  notes?: string;
  catalogItemId?: string;
};

export type ToolResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Resolve a pack name the user mentioned into pack ids the model can use.
 *
 * Returns the match list rather than a single pack: when a query matches
 * several packs the model needs to see them all so it can ask which one,
 * instead of silently writing to the wrong pack.
 */
export function listUserPacksFromStore({
  packs,
  nameQuery,
}: {
  packs: Record<string, PackInStore>;
  nameQuery?: string | null;
}): ToolResult<PackMatchSummary[]> {
  const matches = matchPacksByName({ packs: Object.values(packs), nameQuery });
  return { success: true, data: matches };
}

/** Catalog ids in the API are numeric; a non-numeric value from the model means
 *  "not a catalog item" rather than an error. */
function parseCatalogItemId(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Build the pack-item payload for an `addItemToPack` call.
 *
 * Split out from the write itself so the defaulting rules are unit testable
 * without a Legend-State store: an item added without a weight silently
 * degrades the pack totals the app exists to compute, so the defaults matter.
 */
export function buildPackItemInput(input: AddItemToPackInput): PackItemInput {
  return {
    name: input.name.trim(),
    weight: input.weight ?? 0,
    weightUnit: input.weightUnit ?? 'g',
    quantity: Math.max(1, Math.floor(input.quantity ?? 1)),
    category: input.category?.trim() || 'general',
    consumable: input.consumable ?? false,
    worn: input.worn ?? false,
    notes: input.notes,
    catalogItemId: parseCatalogItemId(input.catalogItemId),
  };
}

/**
 * Validate an `addItemToPack` call against the local store and produce the item
 * payload to write.
 *
 * Returns the resolved pack so the caller can confirm which pack it wrote to —
 * the assistant has to name the pack back to the user, and it must not claim
 * success against a pack that is deleted or was never there.
 */
export function prepareAddItemToPack({
  packs,
  input,
}: {
  packs: Record<string, PackInStore>;
  input: AddItemToPackInput;
}): ToolResult<{ pack: PackInStore; itemData: PackItemInput }> {
  const pack = packs[input.packId];
  if (!pack || pack.deleted) {
    return {
      success: false,
      error: `No pack with id ${input.packId} exists on this device. Call listUserPacks to resolve the pack by name first.`,
    };
  }

  if (!input.name.trim()) {
    return { success: false, error: 'An item name is required.' };
  }

  return { success: true, data: { pack, itemData: buildPackItemInput(input) } };
}

/** Shape the tool output the model sees after a successful add. */
export function describeAddedItem({
  pack,
  item,
}: {
  pack: PackInStore;
  item: Pick<PackItem, 'id' | 'name' | 'quantity' | 'weight' | 'weightUnit' | 'category'>;
}) {
  return {
    packId: pack.id,
    packName: pack.name,
    item: {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      weight: item.weight,
      weightUnit: item.weightUnit,
      category: item.category,
    },
  };
}
