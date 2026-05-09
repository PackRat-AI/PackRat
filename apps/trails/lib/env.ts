import { z } from 'zod';

const trailsEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('https://api.packratai.com'),
});

export type TrailsEnv = z.infer<typeof trailsEnvSchema>;

export const trailsEnv = trailsEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
