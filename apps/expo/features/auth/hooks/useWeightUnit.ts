import { use$ } from '@legendapp/state/react';
import type { WeightUnit } from '@packrat/units';
import { displayWeight, normalize } from '@packrat/units';
import { preferencesStore } from 'expo-app/features/auth/store/preferences';
import { getDefaultWeightUnit } from 'expo-app/lib/unitDefaults';

export function useWeightUnit() {
  const stored = use$(preferencesStore.weightUnit);
  const unit: 'kg' | 'lb' = stored ?? getDefaultWeightUnit();

  const setWeightUnit = (value: 'kg' | 'lb') => {
    preferencesStore.weightUnit.set(value);
  };

  const convertWeight = ({
    weight,
    fromUnit,
  }: {
    weight: number;
    fromUnit: WeightUnit;
  }): number => {
    const grams = normalize({ weight, unit: fromUnit });
    return displayWeight({ grams, unit });
  };

  return { unit, setWeightUnit, convertWeight };
}
