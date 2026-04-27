import { userStore } from 'expo-app/features/auth/store';
import { computeCategorySummaries, convertFromGrams, convertToGrams } from '../utils';
import { usePackDetailsFromStore } from './usePackDetailsFromStore';

export function usePackWeightAnalysis(packId: string) {
  const pack = usePackDetailsFromStore(packId);

  const consumableWeightInGrams = pack.items
    .filter((item) => item.consumable)
    .reduce((sum, item) => {
      const unit = item.weightUnit || 'g';
      const weight = item.weight || 0;
      return sum + convertToGrams(weight * item.quantity, unit);
    }, 0);

  const wornWeightInGrams = pack.items
    .filter((item) => item.worn)
    .reduce((sum, item) => {
      const unit = item.weightUnit || 'g';
      const weight = item.weight || 0;
      return sum + convertToGrams(weight * item.quantity, unit);
    }, 0);

  const categorySummaries = computeCategorySummaries(pack);

  return {
    data: {
      baseWeight: pack.baseWeight,
      consumableWeight: convertFromGrams(
        consumableWeightInGrams,
        userStore.preferredWeightUnit.peek() ?? 'g',
      ),
      wornWeight: convertFromGrams(wornWeightInGrams, userStore.preferredWeightUnit.peek() ?? 'g'),
      totalWeight: pack.totalWeight,
      categories: categorySummaries,
    },
    items: pack.items,
  };
}
