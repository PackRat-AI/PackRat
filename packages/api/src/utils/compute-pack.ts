import type { PackWithItems } from '@packrat/db';
import type { WeightUnit } from '@packrat/units';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';

export const computePackWeights = ({
  pack,
  preferredUnit = 'g',
}: {
  pack: PackWithItems;
  preferredUnit?: WeightUnit;
}): PackWithItems & { baseWeight: number; totalWeight: number } => {
  if (!pack.items) {
    throw new Error(`Pack with ID ${pack.id} has no items`);
  }

  let baseWeightGrams = 0;
  let totalWeightGrams = 0;

  for (const item of pack.items) {
    const itemWeightInGrams =
      normalize({ weight: item.weight, unit: parseWeightUnit({ value: item.weightUnit }) }) *
      item.quantity;
    totalWeightGrams += itemWeightInGrams;
    if (!item.consumable && !item.worn) {
      baseWeightGrams += itemWeightInGrams;
    }
  }

  return {
    ...pack,
    baseWeight: displayWeight({ grams: baseWeightGrams, unit: preferredUnit }),
    totalWeight: displayWeight({ grams: totalWeightGrams, unit: preferredUnit }),
  };
};

export const computePacksWeights = ({
  packs,
  preferredUnit = 'g',
}: {
  packs: PackWithItems[];
  preferredUnit?: WeightUnit;
}): (PackWithItems & { baseWeight: number; totalWeight: number })[] =>
  packs.map((pack) => computePackWeights({ pack, preferredUnit }));

export interface PackCategoryBreakdown {
  category: string;
  totalGrams: number;
  totalLbs: number;
  itemCount: number;
  items: string[];
}

export interface PackWeightBreakdown {
  packId: string;
  totalGrams: number;
  baseGrams: number;
  wornGrams: number;
  consumableGrams: number;
  itemCount: number;
  byCategory: PackCategoryBreakdown[];
}

const GRAMS_PER_LB = 453.592;

/**
 * Full weight breakdown including worn/consumable totals and a per-category
 * grouping sorted heaviest first. Replaces ad-hoc breakdowns the edge apps
 * were computing client-side.
 */
export const computePackBreakdown = (pack: PackWithItems): PackWeightBreakdown => {
  if (!pack.items) {
    throw new Error(`Pack with ID ${pack.id} has no items`);
  }

  let totalGrams = 0;
  let baseGrams = 0;
  let wornGrams = 0;
  let consumableGrams = 0;
  const byCategory: Record<string, PackCategoryBreakdown> = {};

  for (const item of pack.items) {
    const itemGrams =
      normalize({ weight: item.weight, unit: parseWeightUnit({ value: item.weightUnit }) }) *
      item.quantity;
    totalGrams += itemGrams;
    if (item.worn) wornGrams += itemGrams;
    if (item.consumable) consumableGrams += itemGrams;
    if (!item.worn && !item.consumable) baseGrams += itemGrams;

    const cat = item.category || 'Uncategorized';
    const entry = byCategory[cat] ?? {
      category: cat,
      totalGrams: 0,
      totalLbs: 0,
      itemCount: 0,
      items: [],
    };
    entry.totalGrams += itemGrams;
    entry.itemCount += item.quantity;
    entry.items.push(`${item.name} (${item.weight}${item.weightUnit ?? 'g'} × ${item.quantity})`);
    byCategory[cat] = entry;
  }

  for (const entry of Object.values(byCategory)) {
    entry.totalLbs = Math.round((entry.totalGrams / GRAMS_PER_LB) * 100) / 100;
  }

  // Quantity-aware so the top-level total matches the sum of byCategory
  // itemCount values (a pack with `qty: 3` of a single row counts as 3).
  const itemCount = pack.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    packId: pack.id,
    totalGrams: Math.round(totalGrams),
    baseGrams: Math.round(baseGrams),
    wornGrams: Math.round(wornGrams),
    consumableGrams: Math.round(consumableGrams),
    itemCount,
    byCategory: Object.values(byCategory).sort((a, b) => b.totalGrams - a.totalGrams),
  };
};
