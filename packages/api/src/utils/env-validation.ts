import type { Container } from '@cloudflare/containers';
import { isObject } from '@packrat/guards';
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
  REFRESH_TOKEN_PEPPER: z.string().min(32).optional(),

  // Cloudflare Zero Trust / Access (optional — enables CF Access JWT verification for admin routes)
  CF_ACCESS_TEAM_DOMAIN: z.string().optional(), // e.g. "packrat.cloudflareaccess.com"
  CF_ACCESS_AUD: z.string().optional(), // CF Access policy Application Audience tag

  // Email Configuration
  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'ses']),
  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().email(),

  // AI & External APIs
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string(),
  AI_PROVIDER: z.enum(['openai', 'cloudflare-workers-ai']),
  PERPLEXITY_API_KEY: z.string().startsWith('pplx-'),

  // Weather Services
  OPENWEATHER_KEY: z.string(),
  WEATHER_API_KEY: z.string(),

  // Cloudflare R2 Storage (config values)
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  CLOUDFLARE_AI_GATEWAY_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  PACKRAT_BUCKET_R2_BUCKET_NAME: z.string(),
  PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: z.string(),
  PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: z.string(),
  R2_PUBLIC_URL: z.string().url(),

  // Container Configuration
  CONTAINER_PORT: z.string().regex(/^\d+$/, 'Must be a valid port number').optional(),

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
  // App container Durable Object binding (APP_CONTAINER)
  APP_CONTAINER: z.unknown(),
  // Rate limiting binding (optional — not present in local dev/test)
  TOKEN_RATE_LIMITER: z.unknown().optional(),
});

// Relaxed schema for test environments
const testEnvSchema = apiEnvSchema.partial().extend({
  ENVIRONMENT: z.enum(['development', 'production']).default('development'),
  SENTRY_DSN: z.string().url().optional().default('https://test@test.ingest.sentry.io/test'),
  NEON_DATABASE_URL: z.string().optional().default('postgres://user:pass@localhost/db'),
  NEON_DATABASE_URL_READONLY: z.string().optional().default('postgres://user:pass@localhost/db'),
  JWT_SECRET: z.string().optional().default('secret'),
  CF_VERSION_METADATA: z.unknown().optional().default({ id: 'test-version' }),
  AI: z.unknown().optional(),
  PACKRAT_SCRAPY_BUCKET: z.unknown().optional(),
  PACKRAT_BUCKET: z.unknown().optional(),
  PACKRAT_GUIDES_BUCKET: z.unknown().optional(),
  ETL_QUEUE: z.unknown().optional(),
  LOGS_QUEUE: z.unknown().optional(),
  EMBEDDINGS_QUEUE: z.unknown().optional(),
  APP_CONTAINER: z.unknown().optional(),
});

type ValidatedAppEnv = z.infer<typeof apiEnvSchema>;

// Override Cloudflare binding types with proper TypeScript types
export type ValidatedEnv = Omit<
  ValidatedAppEnv,
  | 'CF_VERSION_METADATA'
  | 'AI'
  | 'PACKRAT_SCRAPY_BUCKET'
  | 'PACKRAT_BUCKET'
  | 'PACKRAT_GUIDES_BUCKET'
  | 'ETL_QUEUE'
  | 'LOGS_QUEUE'
  | 'EMBEDDINGS_QUEUE'
  | 'APP_CONTAINER'
  | 'TOKEN_RATE_LIMITER'
> & {
  CF_VERSION_METADATA: WorkerVersionMetadata;
  AI: Ai;
  PACKRAT_SCRAPY_BUCKET: R2Bucket;
  PACKRAT_BUCKET: R2Bucket;
  PACKRAT_GUIDES_BUCKET: R2Bucket;
  ETL_QUEUE: Queue;
  LOGS_QUEUE: Queue;
  EMBEDDINGS_QUEUE: Queue;
  APP_CONTAINER: DurableObjectNamespace<Container<unknown>>;
  TOKEN_RATE_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
};

// Cache for validated envs keyed by the raw env reference.
const envCache = new WeakMap<object, ValidatedEnv>();

function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    (typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { __vitest__?: unknown }).__vitest__ !== undefined)
  );
}

function validate(rawEnv: Record<string, unknown>): ValidatedEnv {
  const schema = isTestEnvironment() ? testEnvSchema : apiEnvSchema;
  const validated = schema.safeParse(rawEnv);
  if (!validated.success) {
    throw new Error(`Invalid environment variables: ${validated.error.message}`);
  }

  return {
    ...validated.data,
    CF_VERSION_METADATA: (rawEnv.CF_VERSION_METADATA ??
      validated.data.CF_VERSION_METADATA) as WorkerVersionMetadata,
    AI: (rawEnv.AI ?? validated.data.AI) as Ai,
    PACKRAT_SCRAPY_BUCKET: (rawEnv.PACKRAT_SCRAPY_BUCKET ??
      validated.data.PACKRAT_SCRAPY_BUCKET) as R2Bucket,
    PACKRAT_BUCKET: (rawEnv.PACKRAT_BUCKET ?? validated.data.PACKRAT_BUCKET) as R2Bucket,
    PACKRAT_GUIDES_BUCKET: (rawEnv.PACKRAT_GUIDES_BUCKET ??
      validated.data.PACKRAT_GUIDES_BUCKET) as R2Bucket,
    ETL_QUEUE: (rawEnv.ETL_QUEUE ?? validated.data.ETL_QUEUE) as Queue,
    LOGS_QUEUE: (rawEnv.LOGS_QUEUE ?? validated.data.LOGS_QUEUE) as Queue,
    EMBEDDINGS_QUEUE: (rawEnv.EMBEDDINGS_QUEUE ?? validated.data.EMBEDDINGS_QUEUE) as Queue,
    APP_CONTAINER: (rawEnv.APP_CONTAINER ?? validated.data.APP_CONTAINER) as DurableObjectNamespace<
      Container<unknown>
    >,
    TOKEN_RATE_LIMITER: rawEnv.TOKEN_RATE_LIMITER as ValidatedEnv['TOKEN_RATE_LIMITER'] | undefined,
  } as ValidatedEnv;
}

/**
 * Module-level cache of the Cloudflare Worker env bindings. Primed once per
 * isolate by the entry point (`src/index.ts`).
 */
let cachedRawEnv: Record<string, unknown> | undefined;

function getRawEnv(): Record<string, unknown> {
  if (cachedRawEnv) return cachedRawEnv;

  const primed = (globalThis as Record<string, unknown>).__cfWorkersEnv__;
  if (isObject(primed)) {
    cachedRawEnv = primed as Record<string, unknown>;
    return cachedRawEnv;
  }

  // Test / Node fallback
  cachedRawEnv = { ...process.env } as Record<string, unknown>;
  return cachedRawEnv;
}

/**
 * Called from the Cloudflare Worker fetch/queue handler to prime the isolate
 * env cache before any downstream code runs.
 */
export function setWorkerEnv(rawEnv: Record<string, unknown>): void {
  cachedRawEnv = rawEnv;
  (globalThis as Record<string, unknown>).__cfWorkersEnv__ = rawEnv;
}

/**
 * Get and validate environment variables for the current isolate.
 *
 * Accepts an optional explicit env object (used primarily by tests) – when
 * omitted, reads from the cached isolate env.
 */
export function getEnv(explicitEnv?: Record<string, unknown>): ValidatedEnv {
  const rawEnv = explicitEnv ?? getRawEnv();
  const cached = envCache.get(rawEnv as object);
  if (cached) return cached;
  const validated = validate(rawEnv);
  envCache.set(rawEnv as object, validated);
  return validated;
}

/**
 * Validate Cloudflare API environment variables at build/deploy time.
 */
export function validateCloudflareApiEnv(env: Record<string, unknown>): void {
  apiEnvSchema.parse(env);
}
