import { isString } from '@packrat/guards';

// Exact avoirdupois values per NIST. These constants are the single source of
// truth for all weight math in the monorepo — do not inline elsewhere.
const TO_GRAMS = {
  g: 1,
  kg: 1_000,
  oz: 28.349523125,
  lb: 453.59237,
} as const;

export const WEIGHT_UNITS = Object.freeze(['g', 'kg', 'oz', 'lb'] as const);

export type WeightUnit = keyof typeof TO_GRAMS;

/**
 * Normalize a weight value to grams.
 * Use this before summing items with mixed units.
 */
export function normalize(weight: number, unit: WeightUnit): number {
  return weight * TO_GRAMS[unit];
}

/**
 * Convert grams back to a target unit.
 */
export function fromGrams(grams: number, unit: WeightUnit): number {
  return grams / TO_GRAMS[unit];
}

/**
 * Convert directly between any two weight units.
 */
export function convert(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  return (weight * TO_GRAMS[from]) / TO_GRAMS[to];
}

/**
 * Format a gram value for display in the given unit.
 * Returns a number rounded to `precision` decimal places (default 2).
 * Use this for all weight display — never roll your own toFixed.
 */
export function displayWeight(grams: number, unit: WeightUnit, precision = 2): number {
  return parseFloat(fromGrams(grams, unit).toFixed(precision));
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
export function parseWeightUnit(value: unknown, fallback: WeightUnit = 'g'): WeightUnit {
  return isWeightUnit(value) ? value : fallback;
}
