import { use$ } from '@legendapp/state/react';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import { preferencesStore } from 'expo-app/features/auth/store/preferences';
import { getDefaultWeightUnit } from 'expo-app/lib/unitDefaults';
import { computeCategorySummaries } from '../utils';
import { usePackDetailsFromStore } from './usePackDetailsFromStore';

export function usePackWeightAnalysis(packId: string) {
  const pack = usePackDetailsFromStore(packId);
  const storedUnit = use$(preferencesStore.weightUnit);
  const preferredUnit = storedUnit ?? getDefaultWeightUnit();

  const toGrams = (item: { weight: number; weightUnit?: string | null; quantity: number }) =>
    normalize({
      weight: (item.weight || 0) * item.quantity,
      unit: parseWeightUnit({ value: item.weightUnit }),
    });

  const consumableGrams = pack.items
    .filter((i) => i.consumable)
    .reduce((s, i) => s + toGrams(i), 0);
  const wornGrams = pack.items.filter((i) => i.worn).reduce((s, i) => s + toGrams(i), 0);

  const categorySummaries = computeCategorySummaries({ pack, preferredUnit });

  return {
    data: {
      baseWeight: displayWeight({ grams: pack.baseWeight, unit: preferredUnit }),
      consumableWeight: displayWeight({ grams: consumableGrams, unit: preferredUnit }),
      wornWeight: displayWeight({ grams: wornGrams, unit: preferredUnit }),
      totalWeight: displayWeight({ grams: pack.totalWeight, unit: preferredUnit }),
      categories: categorySummaries,
    },
    items: pack.items,
    preferredUnit,
  };
}
