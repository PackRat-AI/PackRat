// Bun loads .env files automatically — no dotenv needed.

import { z } from 'zod';

const envSchema = z
  .object({
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_ENDPOINT_URL: z.string().url().optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  })
  .transform((raw) => ({
    R2_ACCESS_KEY_ID: raw.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: raw.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: raw.PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME ?? raw.R2_BUCKET_NAME ?? '',
    R2_ENDPOINT_URL:
      raw.R2_ENDPOINT_URL ??
      (raw.CLOUDFLARE_ACCOUNT_ID
        ? `https://${raw.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : ''),
  }));

export type AnalyticsEnv = z.output<typeof envSchema>;

let _cached: AnalyticsEnv | undefined;

/** Lazily validates and returns analytics env vars. Throws on missing required vars. */
export function env(): AnalyticsEnv {
  if (!_cached) _cached = envSchema.parse(process.env);
  return _cached;
}
