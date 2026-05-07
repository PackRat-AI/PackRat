/**
 * Trails app environment shim.
 * Parses `process.env` once at module load using Zod and exports a typed result.
 *
 * Adding a new variable: declare it on `trailsEnvSchema`, mark it
 * `.optional()` unless every caller genuinely requires it.
 */

import { z } from 'zod';

const trailsEnvSchema = z.object({
  // Dev override: point the api client at a local server instead of the CF Worker proxy.
  NEXT_PUBLIC_PACKRAT_API_ORIGIN: z.string().url().optional(),
});

export type TrailsEnv = z.infer<typeof trailsEnvSchema>;

export const trailsEnv = trailsEnvSchema.parse({
  NEXT_PUBLIC_PACKRAT_API_ORIGIN: process.env.NEXT_PUBLIC_PACKRAT_API_ORIGIN,
});
