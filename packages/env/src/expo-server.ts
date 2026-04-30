/**
 * Expo server-side environment shim for `apps/expo`.
 *
 * Parses server-only variables at module load using Zod and exports the
 * typed result as `serverEnv`. These variables are NOT available in the
 * client bundle — only use this in Expo API routes or server functions.
 *
 * NOTE: This file must NOT be imported in client-side components.
 * Client-side variables (EXPO_PUBLIC_*) belong in `@packrat/env/expo-client`.
 */

import { z } from 'zod';

export const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const processEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

/**
 * Typed env parsed from `process.env` at module load. Throws a Zod
 * validation error if any required value is missing or fails its schema
 * constraint.
 */
export const serverEnv = serverEnvSchema.parse(processEnv);
