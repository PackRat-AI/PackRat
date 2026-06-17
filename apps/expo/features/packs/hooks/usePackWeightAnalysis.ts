import { use$ } from '@legendapp/state/react';
import { preferencesStore } from 'expo-app/features/auth/store/preferences';
import { getDefaultWeightUnit } from 'expo-app/lib/unitDefaults';
import { computeCategorySummaries, convertFromGrams, convertToGrams } from '../utils';
import { usePackDetailsFromStore } from './usePackDetailsFromStore';

export function usePackWeightAnalysis(packId: string) {
  const pack = usePackDetailsFromStore(packId);
  const storedUnit = use$(preferencesStore.weightUnit);
  const preferredUnit = storedUnit ?? getDefaultWeightUnit();

  const consumableWeightInGrams = pack.items
    .filter((item) => item.consumable)
    .reduce((sum, item) => {
      const unit = item.weightUnit || 'g';
      const weight = item.weight || 0;
      return sum + convertToGrams({ weight: weight * item.quantity, unit: unit });
    }, 0);

  const wornWeightInGrams = pack.items
    .filter((item) => item.worn)
    .reduce((sum, item) => {
      const unit = item.weightUnit || 'g';
      const weight = item.weight || 0;
      return sum + convertToGrams({ weight: weight * item.quantity, unit: unit });
    }, 0);

  const categorySummaries = computeCategorySummaries(pack, preferredUnit);

  return {
    data: {
      baseWeight: convertFromGrams({
        grams: convertToGrams({ weight: pack.baseWeight, unit: 'g' }),
        unit: preferredUnit,
      }),
      consumableWeight: convertFromGrams({ grams: consumableWeightInGrams, unit: preferredUnit }),
      wornWeight: convertFromGrams({ grams: wornWeightInGrams, unit: preferredUnit }),
      totalWeight: convertFromGrams({
        grams: convertToGrams({ weight: pack.totalWeight, unit: 'g' }),
        unit: preferredUnit,
      }),
      categories: categorySummaries,
    },
    items: pack.items,
    preferredUnit,
  };
}
