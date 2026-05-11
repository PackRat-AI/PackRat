import type { WeightUnit } from '@packrat/units';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import type { Pack } from '../types';

export const computePackWeights = (
  pack: Omit<Pack, 'baseWeight' | 'totalWeight'>,
  preferredUnit: WeightUnit = 'g',
): Pack => {
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
