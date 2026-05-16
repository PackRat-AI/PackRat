import type { WeightUnit } from '@packrat/units';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import type { PackTemplate } from '../types';

export const computePackTemplateWeights = (
  template: Omit<PackTemplate, 'baseWeight' | 'totalWeight'>,
  preferredUnit: WeightUnit = 'g',
): PackTemplate => {
  let baseWeightGrams = 0;
  let totalWeightGrams = 0;

  for (const item of template.items) {
    const itemWeightInGrams =
      normalize(item.weight, parseWeightUnit(item.weightUnit)) * item.quantity;
    totalWeightGrams += itemWeightInGrams;
    if (!item.consumable && !item.worn) {
      baseWeightGrams += itemWeightInGrams;
    }
  }

  return {
    ...template,
    baseWeight: displayWeight(baseWeightGrams, preferredUnit),
    totalWeight: displayWeight(totalWeightGrams, preferredUnit),
  };
};
