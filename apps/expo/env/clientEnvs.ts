import { z } from 'zod';

export const clientEnvSchema = z.object({
  API_URL: z.string(),
});

const processEnv = {
  API_URL: process.env.EXPO_PUBLIC_API_URL,
};

export const clientEnvs = clientEnvSchema.parse(processEnv);
