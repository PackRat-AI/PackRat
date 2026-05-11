import { z } from 'zod';

const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
});

export const webEnv = webEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
