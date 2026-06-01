import { z } from 'zod';

export type { ValidationError } from '@packrat/db/validation';

export const ValidationErrorSchema = z.object({
  field: z.string(),
  reason: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const ValidationErrorsSchema = z.array(ValidationErrorSchema);
