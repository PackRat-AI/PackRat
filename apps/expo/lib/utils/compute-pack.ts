import type { WeightUnit } from '@packrat/units';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import type { Pack } from 'expo-app/types';

export const computePackWeights = ({
  pack,
  preferredUnit = 'g',
}: {
  pack: Pack;
  preferredUnit?: WeightUnit;
}): Pack => {
  if (!pack.items) {
    throw new Error(`Pack with ID ${pack.id} has no items`);
  }

  let baseWeightGrams = 0;
  let totalWeightGrams = 0;

  for (const item of pack.items) {
    const itemWeightInGrams =
      normalize({ weight: item.weight, unit: parseWeightUnit({ value: item.weightUnit }) }) *
      item.quantity;
    totalWeightGrams += itemWeightInGrams;
    if (!item.consumable && !item.worn) {
      baseWeightGrams += itemWeightInGrams;
    }
  }

  return {
    ...pack,
    baseWeight: displayWeight({ grams: baseWeightGrams, unit: preferredUnit }),
    totalWeight: displayWeight({ grams: totalWeightGrams, unit: preferredUnit }),
  };
};

export const computePacksWeights = ({
  packs,
  preferredUnit = 'g',
}: {
  packs: Pack[];
  preferredUnit?: WeightUnit;
}): Pack[] => packs.map((pack) => computePackWeights({ pack, preferredUnit }));
