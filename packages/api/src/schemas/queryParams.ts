import { z } from '@hono/zod-openapi';

const DIGITS_REGEX = /^\d+$/;

export const positiveIntegerQueryParam = (defaultValue: string) =>
  z
    .string()
    .regex(DIGITS_REGEX)
    .optional()
    .default(defaultValue)
    .transform((value) => Number(value))
    .pipe(z.number().int().positive());
