import { z } from 'zod';

// No production default: an unset NEXT_PUBLIC_API_URL during local development
// used to send a dev run at production data silently. Falling back to the local
// API instead fails visibly when nothing is running, which is the safe direction.
const trailsEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:8787'),
});

export type TrailsEnv = z.infer<typeof trailsEnvSchema>;

export const trailsEnv = trailsEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
