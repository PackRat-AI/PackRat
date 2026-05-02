import type { WeightUnit } from '../packs/types';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: 'USER' | 'ADMIN';
  preferredWeightUnit: WeightUnit;
}
