import { WEIGHT_UNITS, type WeightUnit } from '@packrat/constants';
import { isString } from '@packrat/guards';

export { WEIGHT_UNITS, type WeightUnit };

// Exact avoirdupois values per NIST. These constants are the single source of
// truth for all weight math in the monorepo — do not inline elsewhere.
const TO_GRAMS = {
  g: 1,
  kg: 1_000,
  oz: 28.349523125,
  lb: 453.59237,
} as const;

/**
 * Normalize a weight value to grams.
 * Use this before summing items with mixed units.
 */
export function normalize({ weight, unit }: { weight: number; unit: WeightUnit }): number {
  return weight * TO_GRAMS[unit];
}

/**
 * Convert grams back to a target unit.
 */
export function fromGrams({ grams, unit }: { grams: number; unit: WeightUnit }): number {
  return grams / TO_GRAMS[unit];
}

/**
 * Convert directly between any two weight units.
 */
export function convert({
  weight,
  units,
}: {
  weight: number;
  units: { from: WeightUnit; to: WeightUnit };
}): number {
  if (units.from === units.to) return weight;
  return (weight * TO_GRAMS[units.from]) / TO_GRAMS[units.to];
}

/**
 * Format a gram value for display in the given unit, rounded to 2 decimal places.
 * Use this for all weight display — never roll your own toFixed.
 */
export function displayWeight({ grams, unit }: { grams: number; unit: WeightUnit }): number {
  return parseFloat(fromGrams({ grams, unit }).toFixed(2));
}

/**
 * Type guard — returns true if the value is a valid WeightUnit string.
 */
export function isWeightUnit(value: unknown): value is WeightUnit {
  return isString(value) && (WEIGHT_UNITS as readonly string[]).includes(value);
}

/**
 * Parse an untrusted string into a WeightUnit, falling back to the default.
 */
export function parseWeightUnit({
  value,
  fallback = 'g',
}: {
  value: unknown;
  fallback?: WeightUnit;
}): WeightUnit {
  return isWeightUnit(value) ? value : fallback;
}
