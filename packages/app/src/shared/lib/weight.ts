import { atom } from 'jotai';

export type WeightUnit = 'g' | 'oz' | 'kg' | 'lb';

export const weightUnitAtom = atom<WeightUnit>('oz');

export function toGrams(weight: number, unit: WeightUnit): number {
  switch (unit) {
    case 'oz':
      return Math.round(weight * 28.3495);
    case 'kg':
      return Math.round(weight * 1000);
    case 'lb':
      return Math.round(weight * 453.592);
    default:
      return weight;
  }
}

export function fromGrams(grams: number, unit: WeightUnit): number {
  switch (unit) {
    case 'oz':
      return Math.round((grams / 28.3495) * 10) / 10;
    case 'kg':
      return Math.round((grams / 1000) * 100) / 100;
    case 'lb':
      return Math.round((grams / 453.592) * 10) / 10;
    default:
      return grams;
  }
}

export function formatWeight(grams: number, unit: WeightUnit): string {
  const value = fromGrams(grams, unit);
  return `${value}${unit}`;
}

export function gramsToLbs(grams: number): string {
  const lbs = grams / 453.592;
  const wholeLbs = Math.floor(lbs);
  const oz = Math.round((lbs - wholeLbs) * 16);
  if (oz === 0) return `${wholeLbs} lbs`;
  return `${wholeLbs}.${oz} lbs`;
}

export type WeightClass = 'ultralight' | 'lightweight' | 'standard';

export function weightClass(grams: number): WeightClass {
  if (grams < 100) return 'ultralight';
  if (grams < 300) return 'lightweight';
  return 'standard';
}
