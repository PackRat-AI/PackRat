import type { PackItem, WeightUnit } from '~/types';

// Convert weight between units
export const convertWeight = (weight: number, from: WeightUnit, to: WeightUnit): number => {
  if (from === to) return weight;

  // Convert to grams first
  let grams = weight;
  if (from === 'oz') grams = weight * 28.35;
  if (from === 'lb') grams = weight * 453.59;
  if (from === 'kg') grams = weight * 1000;

  // Convert from grams to target unit
  if (to === 'g') return Math.round(grams);
  if (to === 'oz') return Math.round((grams / 28.35) * 100) / 100;
  if (to === 'lb') return Math.round((grams / 453.59) * 100) / 100;
  if (to === 'kg') return Math.round((grams / 1000) * 100) / 100;

  return weight;
};

// Format weight with unit
export const formatWeight = (weight: number, unit: WeightUnit): string => {
  return `${weight}${unit}`;
};

// Calculate base weight (non-consumable, non-worn items)
export const calculateBaseWeight = (items: PackItem[], unit: WeightUnit = 'g'): number => {
  return items
    .filter((item) => !item.consumable && !item.worn)
    .reduce((total, item) => {
      const weightInTargetUnit = convertWeight(item.weight * item.quantity, item.weightUnit, unit);
      return total + weightInTargetUnit;
    }, 0);
};

// Calculate total weight
export const calculateTotalWeight = (items: PackItem[], unit: WeightUnit = 'g'): number => {
  return items.reduce((total, item) => {
    const weightInTargetUnit = convertWeight(item.weight * item.quantity, item.weightUnit, unit);
    return total + weightInTargetUnit;
  }, 0);
};
