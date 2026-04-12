/**
 * Typed environment variables for the guides Next.js app.
 *
 * Parses `process.env` once at module load using Zod and exports the
 * typed result as `guideEnv`. Follows the same pattern as
 * `apps/expo/env/clientEnvs.ts`.
 *
 * NOTE: `process.env.NODE_ENV` is statically replaced by Next.js at
 * build time, so it is safe to include here. Server-only vars (e.g.
 * `PACKRAT_API_KEY`) are optional — callers must check for presence
 * before using.
 */

import { z } from 'zod';

const guideEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PACKRAT_API_KEY: z.string().optional(),
});

export const guideEnv = guideEnvSchema.parse(process.env);
