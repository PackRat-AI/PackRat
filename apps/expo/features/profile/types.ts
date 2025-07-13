import type { WeightUnit } from '../packs';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN';
  preferredWeightUnit: WeightUnit;
}
