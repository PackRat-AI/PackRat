import type { PackWithItems } from '@packrat/api/db/schema';
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
