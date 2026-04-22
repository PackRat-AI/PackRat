/**
 * Next.js environment shim for `apps/admin`.
 *
 * Parses `NEXT_PUBLIC_*` variables at module load using Zod and exports the
 * typed result as `adminEnv`. Follows the T3-Env pattern: all `process.env.*`
 * accesses are explicit so Next.js can inline them at build time.
 *
 * NEXT_PUBLIC_API_URL is optional here so that `next build` (static export)
 * succeeds even when the variable is absent from the build environment. Callers
 * must assert presence at runtime before use.
 */

import { z } from 'zod';

export const adminEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

// Explicit process.env access is required so Next.js can statically inline values.
const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
};

/**
 * Typed env parsed from `process.env` at module load. Throws a Zod
 * validation error if any value fails its schema constraint.
 */
export const adminEnv = adminEnvSchema.parse(processEnv);
