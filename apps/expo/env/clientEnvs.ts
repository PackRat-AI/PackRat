import { z } from 'zod';

export const clientEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  EXPO_PUBLIC_API_URL: z.string().url(),
  EXPO_PUBLIC_R2_PUBLIC_URL: z.string().url(),
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: z.string(),
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: z.string(),
});

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_R2_PUBLIC_URL: process.env.EXPO_PUBLIC_R2_PUBLIC_URL,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};

export const clientEnvs = clientEnvSchema.parse(processEnv);
