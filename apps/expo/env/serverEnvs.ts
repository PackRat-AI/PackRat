import { z } from 'zod';

export const serverEnvs = z.object({
  OPENAI_API_KEY: z.string(),
});

const processEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

export const serverEnv = serverEnvs.parse(processEnv);
