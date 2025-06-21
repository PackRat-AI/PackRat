import { WeightUnit } from '../types';

export const convertFromGrams = (grams: number, unit: WeightUnit): number => {
  switch (unit) {
    case 'g':
      return grams;
    case 'oz':
      return grams / 28.35;
    case 'kg':
      return grams / 1000;
    case 'lb':
      return grams / 453.59;
    default:
      return grams;
  }
};
