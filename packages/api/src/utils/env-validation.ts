import type { Ai, Queue, R2Bucket } from '@cloudflare/workers-types';
import type { Context } from 'hono';
import { env } from 'hono/adapter';
import { z } from 'zod';

// Define the Zod schema for all environment variables
export const apiEnvSchema = z.object({
  // Environment & Deployment
  ENVIRONMENT: z.enum(['development', 'production']).default('production'),
  SENTRY_DSN: z.string().url(),

  // Database
  NEON_DATABASE_URL: z.string().url(),
  NEON_DATABASE_URL_READONLY: z.string().url(),

  // Authentication & Security
  JWT_SECRET: z.string(),
  PASSWORD_RESET_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  ADMIN_USERNAME: z.string(),
  ADMIN_PASSWORD: z.string(),
  PACKRAT_API_KEY: z.string(),

  // Email Configuration
  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'ses']),
  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().email(),

  // AI & External APIs
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  AI_PROVIDER: z.enum(['openai', 'cloudflare-workers-ai']),

  // Weather Services
  OPENWEATHER_KEY: z.string(),
  WEATHER_API_KEY: z.string(),

  // Cloudflare R2 Storage (config values)
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  CLOUDFLARE_ACCOUNT_ID_ORG: z.string(),
  CLOUDFLARE_AI_GATEWAY_ID_ORG: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  PACKRAT_BUCKET_R2_BUCKET_NAME: z.string(),
  PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: z.string(),
  PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: z.string(),

  // Content & Guides
  PACKRAT_GUIDES_RAG_NAME: z.string(),
  PACKRAT_GUIDES_BASE_URL: z.string().url(),

  // Cloudflare bindings - validated as any, typed properly below
  CF_VERSION_METADATA: z.unknown(),
  AI: z.unknown(),
  PACKRAT_SCRAPY_BUCKET: z.unknown(),
  PACKRAT_BUCKET: z.unknown(),
  PACKRAT_GUIDES_BUCKET: z.unknown(),
  ETL_QUEUE: z.unknown(),
  LOGS_QUEUE: z.unknown(),
  EMBEDDINGS_QUEUE: z.unknown(),
});

// Infer the base type from Zod schema
type ValidatedAppEnv = z.infer<typeof apiEnvSchema>;

// Override Cloudflare binding types with proper TypeScript types
export type Env = Omit<
  ValidatedAppEnv,
  | 'CF_VERSION_METADATA'
  | 'AI'
  | 'PACKRAT_SCRAPY_BUCKET'
  | 'PACKRAT_BUCKET'
  | 'PACKRAT_GUIDES_BUCKET'
  | 'ETL_QUEUE'
  | 'LOGS_QUEUE'
  | 'EMBEDDINGS_QUEUE'
> & {
  // Properly typed Cloudflare bindings
  CF_VERSION_METADATA: WorkerVersionMetadata;
  AI: Ai;
  PACKRAT_SCRAPY_BUCKET: R2Bucket;
  PACKRAT_BUCKET: R2Bucket;
  PACKRAT_GUIDES_BUCKET: R2Bucket;
  ETL_QUEUE: Queue;
  LOGS_QUEUE: Queue;
  EMBEDDINGS_QUEUE: Queue;
};

// Cache for validated environments per request
const envCache = new WeakMap<Context, Env>();

/**
 * Get and validate environment variables from Hono context
 * Results are cached per request context
 */
export function getEnv(c: Context): Env {
  // Check if we already have validated env for this context
  const cached = envCache.get(c);
  if (cached) {
    return cached;
  }

  // Get raw environment
  const rawEnv = env<Env>(c);

  // Validate all environment variables with Zod
  // This ensures all required fields exist, including CF bindings
  const validated = apiEnvSchema.safeParse(rawEnv);
  if (!validated.success) {
    throw new Error(`Invalid environment variables: ${validated.error.message}`);
  }

  // Merge validated data with correctly typed Cloudflare bindings from rawEnv
  const data: Env = {
    ...validated.data,
    CF_VERSION_METADATA: rawEnv.CF_VERSION_METADATA,
    AI: rawEnv.AI,
    PACKRAT_SCRAPY_BUCKET: rawEnv.PACKRAT_SCRAPY_BUCKET,
    PACKRAT_BUCKET: rawEnv.PACKRAT_BUCKET,
    PACKRAT_GUIDES_BUCKET: rawEnv.PACKRAT_GUIDES_BUCKET,
    ETL_QUEUE: rawEnv.ETL_QUEUE,
    LOGS_QUEUE: rawEnv.LOGS_QUEUE,
    EMBEDDINGS_QUEUE: rawEnv.EMBEDDINGS_QUEUE,
  };

  // Cache the result
  envCache.set(c, data);

  return data;
}
