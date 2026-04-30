/**
 * Expo client-side environment shim for `apps/expo`.
 *
 * Parses `EXPO_PUBLIC_*` variables (and `NODE_ENV`) at module load using Zod
 * and exports the typed result as `clientEnvs`. Follows the T3-Env pattern for
 * Expo: all `process.env.*` accesses are explicit so Metro can inline them at
 * build time.
 *
 * NOTE: Only `EXPO_PUBLIC_*` variables are available in the client bundle at
 * runtime — Metro strips all other `process.env.*` accesses. Server-only vars
 * (e.g. `OPENAI_API_KEY`) belong in `@packrat/env/expo-server`.
 */

import { z } from 'zod';

export const clientEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  EXPO_PUBLIC_API_URL: z.string().url(),
  EXPO_PUBLIC_R2_PUBLIC_URL: z.string().url(),
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: z.string(),
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: z.string(),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

// Explicit process.env access is required so Metro can statically inline values.
const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_R2_PUBLIC_URL: process.env.EXPO_PUBLIC_R2_PUBLIC_URL,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
};

/**
 * Typed env parsed from `process.env` at module load. Throws a Zod
 * validation error if any required value is missing or fails its schema
 * constraint.
 */
export const clientEnvs = clientEnvSchema.parse(processEnv);
