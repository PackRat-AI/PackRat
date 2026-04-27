/**
 * Admin app environment shim.
 * Parses `process.env` once at module load using Zod and exports a typed result.
 *
 * Adding a new variable: declare it on `adminEnvSchema`, mark it
 * `.optional()` unless every caller genuinely requires it.
 */

import { z } from 'zod';

const adminEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

/**
 * Typed env parsed from `process.env` at module load. Throws a Zod
 * validation error if any value fails its schema constraint.
 */
export const adminEnv = adminEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
