import { z } from 'zod';

export interface ValidationError {
  field: string;
  reason: string;
  value?: string | number | boolean | null | undefined;
}

export const ValidationErrorSchema = z.object({
  field: z.string(),
  reason: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const ValidationErrorsSchema = z.array(ValidationErrorSchema);
