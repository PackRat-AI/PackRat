import { normalize, parseWeightUnit } from '@packrat/units';

export function convertToGrams(weight: number, unit: string): number {
  return normalize(weight, parseWeightUnit(unit));
}
