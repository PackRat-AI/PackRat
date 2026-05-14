import type { WeightUnit } from '@packrat/db';

export interface PackItemInput {
  name: string;
  description?: string | null;
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
