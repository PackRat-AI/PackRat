/**
 * Next.js environment shim for Next.js apps (`apps/guides`, `apps/landing`).
 * Parses `process.env` once at module load using Zod and exports the typed
 * result as `guideEnv`.
 *
 * NOTE: `process.env.NODE_ENV` is statically replaced by Next.js at build
 * time, so it is safe to include here. Server-only vars (e.g. `PACKRAT_API_KEY`)
 * are optional — callers must check for presence before using.
 *
 * Adding a new variable: declare it on `guideEnvSchema`, mark it
 * `.optional()` unless every caller genuinely requires it.
 */

import { z } from 'zod';

export const guideEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PACKRAT_API_KEY: z.string().optional(),
});

export type GuideEnv = z.infer<typeof guideEnvSchema>;

/**
 * Typed env parsed from `process.env` at module load. Throws a Zod
 * validation error if any value fails its schema constraint.
 */
export const guideEnv = guideEnvSchema.parse(process.env);
