import type { PackItem } from '@packrat/api/types';
import type { WeightUnit } from '@packrat/units';
import { convert, displayWeight, fromGrams, normalize, parseWeightUnit } from '@packrat/units';

export { fromGrams as convertFromGrams, convert as convertWeight };
export const convertToGrams = (weight: number, unit: string): number =>
  normalize(weight, parseWeightUnit(unit));

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
