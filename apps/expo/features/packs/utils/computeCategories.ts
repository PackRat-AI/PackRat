import { assertDefined } from '@packrat/guards';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import { userStore } from 'expo-app/features/auth/store';
import type { Pack } from '../types';

export type CategorySummary = {
  name: string;
  items: number;
  weight: number;
  percentage: number;
};

export function computeCategorySummaries(pack: Pack): CategorySummary[] {
  const preferredUnit = parseWeightUnit({
    value: userStore.preferredWeightUnit.peek(),
    fallback: 'g',
  });
  const categoryMap: Record<string, { weightInGrams: number; items: number }> = {};

  let totalWeightGrams = 0;

  for (const item of pack.items) {
    const category = item.category?.trim() || 'Other';
    const itemGrams =
      normalize({ weight: item.weight, unit: parseWeightUnit({ value: item.weightUnit }) }) *
      item.quantity;

    totalWeightGrams += itemGrams;

    if (!categoryMap[category]) {
      categoryMap[category] = { weightInGrams: 0, items: 0 };
    }
    assertDefined(categoryMap[category]);

    categoryMap[category].weightInGrams += itemGrams;
    categoryMap[category].items += 1;
  }

  return Object.entries(categoryMap).map(([name, data]) => ({
    name,
    items: data.items,
    weight: displayWeight({ grams: data.weightInGrams, unit: preferredUnit }),
    percentage: Number(
      (totalWeightGrams > 0 ? (data.weightInGrams / totalWeightGrams) * 100 : 0).toFixed(1),
    ),
  }));
}
