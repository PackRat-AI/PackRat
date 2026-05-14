import type { PackWithItems } from '@packrat/db';
import type { WeightUnit } from '@packrat/units';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';

export type ComputedPack = PackWithItems & {
  baseWeight: number;
  totalWeight: number;
};

export const computePackWeights = (
  pack: PackWithItems,
  preferredUnit: WeightUnit = 'g',
): ComputedPack => {
  if (!pack.items) {
    throw new Error(`Pack with ID ${pack.id} has no items`);
  }

  let baseWeightGrams = 0;
  let totalWeightGrams = 0;

  for (const item of pack.items) {
    const itemWeightInGrams =
      normalize(item.weight, parseWeightUnit(item.weightUnit)) * item.quantity;
    totalWeightGrams += itemWeightInGrams;
    if (!item.consumable && !item.worn) {
      baseWeightGrams += itemWeightInGrams;
    }
  }

  return {
    ...pack,
    baseWeight: displayWeight(baseWeightGrams, preferredUnit),
    totalWeight: displayWeight(totalWeightGrams, preferredUnit),
  };
};

export const computePacksWeights = (
  packs: PackWithItems[],
  preferredUnit: WeightUnit = 'g',
): ComputedPack[] => packs.map((pack) => computePackWeights(pack, preferredUnit));
