import { convertFromGrams, convertToGrams } from 'expo-app/features/packs/utils';
import type { PackTemplate, WeightUnit } from '../types';

export const computePackTemplateWeights = (
  template: Omit<PackTemplate, 'baseWeight' | 'totalWeight'>,
  preferredUnit: WeightUnit = 'g',
): PackTemplate => {
  // Initialize weights
  let baseWeightGrams = 0;
  let totalWeightGrams = 0;

  // Calculate weights based on items
  template.items.forEach((item) => {
    const itemWeightInGrams =
      convertToGrams(item.weight, item.weightUnit as WeightUnit) * item.quantity;

    // Add to total weight
    totalWeightGrams += itemWeightInGrams;

    // Add to base weight only if not consumable and not worn
    if (!item.consumable && !item.worn) {
      baseWeightGrams += itemWeightInGrams;
    }
  });

  // Convert back to preferred unit
  const baseWeight = convertFromGrams(baseWeightGrams, preferredUnit);
  const totalWeight = convertFromGrams(totalWeightGrams, preferredUnit);

  // Return updated template with computed weights
  return {
    ...template,
    baseWeight: Number(baseWeight.toFixed(2)),
    totalWeight: Number(totalWeight.toFixed(2)),
  };
};
