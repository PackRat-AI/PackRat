import { z } from '@hono/zod-openapi';

export const positiveIntegerQueryParam = (defaultValue: string) =>
  z
    .string()
    .regex(/^\d+$/)
    .optional()
    .default(defaultValue)
    .transform((value) => Number(value))
    .pipe(z.number().int().positive());
