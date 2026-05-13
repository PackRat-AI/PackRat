import type { WeightUnit } from '@packrat/units';
import { convert, displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import type { PackItem } from 'expo-app/types';

export { convert as convertWeight };

export const formatWeight = ({ weight, unit }: { weight: number; unit: WeightUnit }): string =>
  `${weight}${unit}`;

export const calculateBaseWeight = ({
  items,
  unit = 'g',
}: {
  items: PackItem[];
  unit?: WeightUnit;
}): number => {
  const grams = items
    .filter((item) => !item.consumable && !item.worn)
    .reduce(
      (total, item) =>
        total +
        normalize({ weight: item.weight, unit: parseWeightUnit({ value: item.weightUnit }) }) *
          item.quantity,
      0,
    );
  return displayWeight({ grams, unit });
};

export const calculateTotalWeight = ({
  items,
  unit = 'g',
}: {
  items: PackItem[];
  unit?: WeightUnit;
}): number => {
  const grams = items.reduce(
    (total, item) =>
      total +
      normalize({ weight: item.weight, unit: parseWeightUnit({ value: item.weightUnit }) }) *
        item.quantity,
    0,
  );
  return displayWeight({ grams, unit });
};
