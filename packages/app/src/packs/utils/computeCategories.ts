import { userStore } from '@packrat/app/auth/store';
import type { Pack } from '@packrat/app/packs';
import { convertFromGrams, convertToGrams } from '@packrat/app/packs';
import { assertDefined } from '@packrat/guards';

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

  for (const item of items) {
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
    assertDefined(categoryMap[category]);

    categoryMap[category].weightInGrams += convertedWeight;
    categoryMap[category].items += 1;
  }

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
