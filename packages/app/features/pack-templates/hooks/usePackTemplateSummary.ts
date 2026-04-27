import { use$ } from '@legendapp/state/react';
import { convertFromGrams, convertToGrams } from 'app/features/packs/utils';
import { packTemplateItemsStore } from '../store/packTemplateItems';
import type { WeightUnit } from '../types';

export type PackTemplateSummary = {
  itemCount: number;
  baseWeight: number;
  totalWeight: number;
};

/**
 * Returns a cheap summary (item count + computed base / total weight) for a
 * pack template without materialising the full list of items.
 *
 * Use this for card/tile views that only need display stats — it avoids the
 * allocations that `usePackTemplateDetails` incurs (which spreads the
 * template and its items on every change).
 */
export function usePackTemplateSummary(
  templateId: string,
  preferredUnit: WeightUnit = 'g',
): PackTemplateSummary {
  return use$(() => {
    let itemCount = 0;
    let baseWeightGrams = 0;
    let totalWeightGrams = 0;

    const items = packTemplateItemsStore.get();
    for (const item of Object.values(items)) {
      if (item.packTemplateId !== templateId || item.deleted) continue;
      itemCount++;
      const itemWeightInGrams = convertToGrams(item.weight, item.weightUnit) * item.quantity;
      totalWeightGrams += itemWeightInGrams;
      if (!item.consumable && !item.worn) {
        baseWeightGrams += itemWeightInGrams;
      }
    }

    return {
      itemCount,
      baseWeight: Number(convertFromGrams(baseWeightGrams, preferredUnit).toFixed(2)),
      totalWeight: Number(convertFromGrams(totalWeightGrams, preferredUnit).toFixed(2)),
    };
  });
}

/**
 * Returns summaries (item count + computed weights) for a batch of pack
 * template ids in a single pass over the items store. Prefer this over
 * calling `usePackTemplateSummary` in a loop (e.g. from list/carousel
 * renderers) — it avoids a `store.get()` per id and scales linearly with the
 * total number of items rather than multiplicatively.
 */
export function usePackTemplateSummaries(
  templateIds: string[],
  preferredUnit: WeightUnit = 'g',
): Record<string, PackTemplateSummary> {
  return use$(() => {
    if (templateIds.length === 0) return {};

    const wanted = new Set(templateIds);
    const grams: Record<string, { base: number; total: number; count: number }> = {};
    for (const id of templateIds) {
      grams[id] = { base: 0, total: 0, count: 0 };
    }

    const items = packTemplateItemsStore.get();
    for (const item of Object.values(items)) {
      if (item.deleted) continue;
      if (!wanted.has(item.packTemplateId)) continue;
      const bucket = grams[item.packTemplateId];
      if (!bucket) continue;
      bucket.count++;
      const itemWeightInGrams = convertToGrams(item.weight, item.weightUnit) * item.quantity;
      bucket.total += itemWeightInGrams;
      if (!item.consumable && !item.worn) {
        bucket.base += itemWeightInGrams;
      }
    }

    const result: Record<string, PackTemplateSummary> = {};
    for (const id of templateIds) {
      const bucket = grams[id] ?? { base: 0, total: 0, count: 0 };
      result[id] = {
        itemCount: bucket.count,
        baseWeight: Number(convertFromGrams(bucket.base, preferredUnit).toFixed(2)),
        totalWeight: Number(convertFromGrams(bucket.total, preferredUnit).toFixed(2)),
      };
    }
    return result;
  });
}
