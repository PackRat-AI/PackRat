import type { Container } from '@cloudflare/containers';
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

// Infer the base type from Zod schema
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
  // AppContainer Durable Object binding (APP_CONTAINER)
  APP_CONTAINER: DurableObjectNamespace<Container<unknown>>;
};

// Cache for validated environments keyed by the raw env reference so we only
// validate once per worker isolate (env is identical for every request on a
// given deployment).
const envCache = new WeakMap<object, ValidatedEnv>();

// Check if we're in a test environment
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
    APP_CONTAINER: (rawEnv.APP_CONTAINER ??
      validated.data.APP_CONTAINER) as DurableObjectNamespace<Container<unknown>>,
  } as ValidatedEnv;
}

/**
 * Module-level cache of the Cloudflare Worker env bindings. Primed by the
 * entrypoint once per isolate so both Elysia routes and any lingering Hono
 * routes can look up the env without needing to plumb it through the context.
 */
let cachedRawEnv: Record<string, unknown> | undefined;

function getRawEnv(): Record<string, unknown> {
  if (cachedRawEnv) return cachedRawEnv;

  // Attempt to pull pre-primed env from a global set by the Elysia entrypoint.
  const primed = (globalThis as Record<string, unknown>).__cfWorkersEnv__;
  if (primed && typeof primed === 'object') {
    cachedRawEnv = primed as Record<string, unknown>;
    return cachedRawEnv;
  }

  // Test / Node fallback - pull from process.env
  cachedRawEnv = { ...process.env } as Record<string, unknown>;
  return cachedRawEnv;
}

/**
 * Allow the Cloudflare Worker entrypoint to prime the env cache with the
 * bindings it received. This is called once per isolate from the fetch/queue
 * handler before any request is processed.
 */
export function setWorkerEnv(rawEnv: Record<string, unknown>): void {
  cachedRawEnv = rawEnv;
  (globalThis as Record<string, unknown>).__cfWorkersEnv__ = rawEnv;
}

type ContextLike = { env?: Record<string, unknown> } | Record<string, unknown>;

/**
 * Get and validate environment variables.
 *
 * Supports three calling conventions:
 *  - `getEnv()` – returns the isolate's cached env (Elysia path)
 *  - `getEnv(env)` – explicit env object (queue handler path)
 *  - `getEnv(c)` – Hono context (legacy path) – reads `c.env` internally
 */
export function getEnv(input?: ContextLike): ValidatedEnv {
  let rawEnv: Record<string, unknown>;
  if (!input) {
    rawEnv = getRawEnv();
  } else if (
    typeof input === 'object' &&
    input !== null &&
    'env' in input &&
    typeof (input as { env?: unknown }).env === 'object'
  ) {
    // Hono Context or Elysia context object with nested `.env`
    rawEnv = (input as { env: Record<string, unknown> }).env;
  } else {
    rawEnv = input as Record<string, unknown>;
  }

  const cached = envCache.get(rawEnv as object);
  if (cached) return cached;
  const validated = validate(rawEnv);
  envCache.set(rawEnv as object, validated);
  return validated;
}

/**
 * Validate Cloudflare API environment variables at build/deploy time
 * Called after root postinstall populates env vars
 * Throws an error if validation fails
 */
export function validateCloudflareApiEnv(env: Record<string, unknown>): void {
  apiEnvSchema.parse(env);
}
