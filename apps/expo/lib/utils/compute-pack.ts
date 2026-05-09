import type { WeightUnit } from '@packrat/units';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import type { Pack } from 'expo-app/types';

export const computePackWeights = (pack: Pack, preferredUnit: WeightUnit = 'g'): Pack => {
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

export const computePacksWeights = (packs: Pack[], preferredUnit: WeightUnit = 'g'): Pack[] =>
  packs.map((pack) => computePackWeights(pack, preferredUnit));
