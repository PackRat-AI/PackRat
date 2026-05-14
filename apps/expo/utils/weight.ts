import type { PackItem } from '@packrat/types';
import type { WeightUnit } from '@packrat/units';
import { convert, displayWeight, normalize, parseWeightUnit } from '@packrat/units';

export { convert as convertWeight };

export const formatWeight = (weight: number, unit: WeightUnit): string => `${weight}${unit}`;

export const calculateBaseWeight = (items: PackItem[], unit: WeightUnit = 'g'): number => {
  const grams = items
    .filter((item) => !item.consumable && !item.worn)
    .reduce(
      (total, item) =>
        total + normalize(item.weight, parseWeightUnit(item.weightUnit)) * item.quantity,
      0,
    );
  return displayWeight(grams, unit);
};

export const calculateTotalWeight = (items: PackItem[], unit: WeightUnit = 'g'): number => {
  const grams = items.reduce(
    (total, item) =>
      total + normalize(item.weight, parseWeightUnit(item.weightUnit)) * item.quantity,
    0,
  );
  return displayWeight(grams, unit);
};
