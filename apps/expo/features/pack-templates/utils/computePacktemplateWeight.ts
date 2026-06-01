import type { WeightUnit } from '@packrat/units';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import type { PackTemplate } from '../types';

export const computePackTemplateWeights = ({
  template,
  preferredUnit = 'g',
}: {
  template: Omit<PackTemplate, 'baseWeight' | 'totalWeight'>;
  preferredUnit?: WeightUnit;
}): PackTemplate => {
  let baseWeightGrams = 0;
  let totalWeightGrams = 0;

  for (const item of template.items) {
    const itemWeightInGrams =
      normalize({ weight: item.weight, unit: parseWeightUnit({ value: item.weightUnit }) }) *
      item.quantity;
    totalWeightGrams += itemWeightInGrams;
    if (!item.consumable && !item.worn) {
      baseWeightGrams += itemWeightInGrams;
    }
  }

  return {
    ...template,
    baseWeight: displayWeight({ grams: baseWeightGrams, unit: preferredUnit }),
    totalWeight: displayWeight({ grams: totalWeightGrams, unit: preferredUnit }),
  };
};
