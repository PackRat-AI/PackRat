import type { WeightUnit } from '@packrat/units';
import { fromGrams } from '@packrat/units';

export const convertFromGrams = (grams: number, unit: WeightUnit): number => fromGrams(grams, unit);
