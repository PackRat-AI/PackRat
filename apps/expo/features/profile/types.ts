import { WeightUnit } from '../packs';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  preferredWeightUnit: WeightUnit;
}
