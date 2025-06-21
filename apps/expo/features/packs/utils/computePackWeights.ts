import { Pack, WeightUnit } from "../types";
import { convertFromGrams } from "./convertFromGrams";
import { convertToGrams } from "./convertToGrams";

export const computePackWeights = (
  pack: Omit<Pack, "baseWeight" | "totalWeight">,
  preferredUnit: WeightUnit = "g",
): Pack => {
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
