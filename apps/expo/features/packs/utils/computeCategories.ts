import { userStore } from 'expo-app/features/auth/store';
import type { Pack } from '../types';
import { convertFromGrams } from './convertFromGrams';
import { convertToGrams } from './convertToGrams';

export type CategorySummary = {
  name: string;
  items: number;
  weight: number;
  percentage: number;
};

export function computeCategorySummaries(pack: Pack): CategorySummary[] {
  const items = pack.items;
  const totalWeight = pack.totalWeight;
  const categoryMap: Record<
    string,
    {
      weightInGrams: number;
      items: number;
    }
  > = {};

  items.forEach((item) => {
    const category = item.category?.trim() || 'Other';
    const weight = item.weight;
    const unit = item.weightUnit;
    const convertedWeight = convertToGrams(weight, unit) * item.quantity;

    if (!categoryMap[category]) {
      categoryMap[category] = {
        weightInGrams: 0,
        items: 0,
      };
    }

    categoryMap[category].weightInGrams += convertedWeight;
    categoryMap[category].items += 1;
  });

  return Object.entries(categoryMap).map(([name, data]) => {
    const percentage =
      totalWeight > 0
        ? (data.weightInGrams /
            convertToGrams(totalWeight, userStore.preferredWeightUnit.peek() ?? 'g')) *
          100
        : 0;

    return {
      name,
      items: data.items,
      weight: convertFromGrams(data.weightInGrams, userStore.preferredWeightUnit.peek() ?? 'g'),
      percentage: Number(percentage.toFixed(1)),
    };
  });
}
