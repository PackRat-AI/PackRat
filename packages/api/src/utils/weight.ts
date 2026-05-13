import type { PackItem } from '@packrat/api/types';
import type { WeightUnit } from '@packrat/units';
import { convert, displayWeight, fromGrams, normalize, parseWeightUnit } from '@packrat/units';

export { fromGrams as convertFromGrams, convert as convertWeight };
export const convertToGrams = ({ weight, unit }: { weight: number; unit: string }): number =>
  normalize({ weight, unit: parseWeightUnit({ value: unit }) });

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
