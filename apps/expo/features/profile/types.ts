import type { UserSchema } from '@packrat/api/schemas/users';
import type { z } from 'zod';
import type { WeightUnit } from '../packs/types';

export type User = z.infer<typeof UserSchema> & {
  preferredWeightUnit?: WeightUnit;
};
