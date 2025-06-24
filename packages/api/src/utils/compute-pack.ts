import { type PackWithItems } from '@/db/schema';
import type { WeightUnit } from '@/types';

// Convert weights to a standard unit (grams) for calculations
const convertToGrams = (weight: number, unit: WeightUnit): number => {
  switch (unit) {
    case "g":
      return weight;
    case "oz":
      return weight * 28.35;
    case "kg":
      return weight * 1000;
    case "lb":
      return weight * 453.59;
    default:
      return weight;
  }
};

// Convert from grams back to the desired unit
const convertFromGrams = (grams: number, unit: WeightUnit): number => {
  switch (unit) {
    case "g":
      return grams;
    case "oz":
      return grams / 28.35;
    case "kg":
      return grams / 1000;
    case "lb":
      return grams / 453.59;
    default:
      return grams;
  }
};

export const computePackWeights = (
  pack: PackWithItems,
  preferredUnit: WeightUnit = "g"
): PackWithItems & {
  baseWeight: number;
  totalWeight: number;
} => {
  if (!pack.items) {
    throw new Error(`Pack with ID ${pack.id} has no items`);
  }

  // Initialize weights
  let baseWeightGrams = 0;
  let totalWeightGrams = 0;

  // Calculate weights based on items
  pack.items.forEach((item) => {
    // Convert item weight to grams for calculation
    const itemWeightInGrams =
      convertToGrams(item.weight, item.weightUnit as WeightUnit) * item.quantity;

    // Add to total weight
    totalWeightGrams += itemWeightInGrams;

    // Add to base weight only if not consumable and not worn
    if (!item.consumable && !item.worn) {
      baseWeightGrams += itemWeightInGrams;
    }
  });

  // Convert back to preferred unit
  const baseWeight = convertFromGrams(baseWeightGrams, preferredUnit);
  const totalWeight = convertFromGrams(totalWeightGrams, preferredUnit);

  // Return updated pack with computed weights
  return {
    ...pack,
    baseWeight: Number(baseWeight.toFixed(2)),
    totalWeight: Number(totalWeight.toFixed(2)),
  };
};

// Helper function to compute weights for a list of packs
export const computePacksWeights = (
  packs: PackWithItems[],
  preferredUnit: WeightUnit = 'g'
): (PackWithItems & {
  baseWeight: number;
  totalWeight: number;
})[] => {
  return packs.map((pack) => computePackWeights(pack, preferredUnit));
};
