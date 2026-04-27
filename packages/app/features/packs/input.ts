import type { WeightUnit } from 'app/types';

export interface PackItemInput {
  name: string;
  description?: string;
  weight: number;
  weightUnit: WeightUnit;
  quantity: number;
  category?: string;
  consumable: boolean;
  worn: boolean;
  notes?: string;
  image?: string | null;
  catalogItemId?: number;
}
