import { normalize, parseWeightUnit } from '@packrat/units';

export function convertToGrams({ weight, unit }: { weight: number; unit: string }): number {
  return normalize({ weight, unit: parseWeightUnit({ value: unit }) });
}
