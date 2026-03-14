// Bun loads .env files automatically — no dotenv needed.

import { z } from 'zod';

const envSchema = z
  .object({
    ANALYTICS_MODE: z.enum(['local', 'catalog']).default('local'),

    // S3 credentials (required for local mode + publish)
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_ENDPOINT_URL: z.string().url().optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),

    // Iceberg credentials (required for catalog mode + publish)
    R2_CATALOG_TOKEN: z.string().optional(),
    R2_CATALOG_URI: z.string().optional(),
    R2_WAREHOUSE_NAME: z.string().optional(),
  })
  .transform((raw) => ({
    ANALYTICS_MODE: raw.ANALYTICS_MODE,
    R2_ACCESS_KEY_ID: raw.R2_ACCESS_KEY_ID ?? '',
    R2_SECRET_ACCESS_KEY: raw.R2_SECRET_ACCESS_KEY ?? '',
    R2_BUCKET_NAME: raw.PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME ?? raw.R2_BUCKET_NAME ?? '',
    R2_ENDPOINT_URL:
      raw.R2_ENDPOINT_URL ??
      (raw.CLOUDFLARE_ACCOUNT_ID
        ? `https://${raw.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : ''),
    R2_CATALOG_TOKEN: raw.R2_CATALOG_TOKEN ?? '',
    R2_CATALOG_URI: raw.R2_CATALOG_URI ?? '',
    R2_WAREHOUSE_NAME: raw.R2_WAREHOUSE_NAME ?? '',
  }))
  .superRefine((data, ctx) => {
    if (data.ANALYTICS_MODE === 'local') {
      if (!data.R2_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'R2_ACCESS_KEY_ID is required for local mode',
          path: ['R2_ACCESS_KEY_ID'],
        });
      }
      if (!data.R2_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'R2_SECRET_ACCESS_KEY is required for local mode',
          path: ['R2_SECRET_ACCESS_KEY'],
        });
      }
    }
    if (data.ANALYTICS_MODE === 'catalog') {
      if (!data.R2_CATALOG_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'R2_CATALOG_TOKEN is required for catalog mode',
          path: ['R2_CATALOG_TOKEN'],
        });
      }
      if (!data.R2_CATALOG_URI) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'R2_CATALOG_URI is required for catalog mode',
          path: ['R2_CATALOG_URI'],
        });
      }
      if (!data.R2_WAREHOUSE_NAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'R2_WAREHOUSE_NAME is required for catalog mode',
          path: ['R2_WAREHOUSE_NAME'],
        });
      }
    }
  });

export type AnalyticsEnv = z.output<typeof envSchema>;

let _cached: AnalyticsEnv | undefined;

/** Lazily validates and returns analytics env vars. Throws on missing required vars. */
export function env(): AnalyticsEnv {
  if (!_cached) _cached = envSchema.parse(process.env);
  return _cached;
}

/** Reset cached env (for testing). */
export function resetEnv(): void {
  _cached = undefined;
}
