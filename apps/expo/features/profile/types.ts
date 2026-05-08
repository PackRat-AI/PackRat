import type { WeightUnit } from '../packs/types';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: 'USER' | 'ADMIN';
  preferredWeightUnit: WeightUnit;
}
