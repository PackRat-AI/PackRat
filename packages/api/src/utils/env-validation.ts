import type { Container } from '@cloudflare/containers';
import { isObject } from '@packrat/guards';
import { z } from 'zod';

// Define the Zod schema for all environment variables
export const apiEnvObjectSchema = z.object({
  // Environment & Deployment
  ENVIRONMENT: z.enum(['development', 'production']).default('production'),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // Database
  NEON_DATABASE_URL: z.string().url(),
  NEON_DATABASE_URL_READONLY: z.string().url(),
  // Dedicated OSM/trail DB (separate from the main app DB).
  // Optional: trail routes return 503 when absent. For Cloudflare Workers,
  // set to env.OSM_HYPERDRIVE.connectionString (Hyperdrive binding).
  OSM_DATABASE_URL: z.string().url().optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(), // API base URL e.g. https://api.packrat.world
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  // Google OAuth (Better Auth social provider)
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  // Apple Sign In (Better Auth social provider)
  APPLE_CLIENT_ID: z.string(), // bundle ID e.g. world.packrat.app
  APPLE_PRIVATE_KEY: z.string(), // .p8 key contents — store via wrangler secret
  APPLE_KEY_ID: z.string(),
  APPLE_TEAM_ID: z.string(),
  // Admin & API key auth (unchanged)
  ADMIN_USERNAME: z.string(),
  ADMIN_PASSWORD: z.string(),
  PACKRAT_API_KEY: z.string(),

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
  CLOUDFLARE_AI_GATEWAY_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
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
  ETL_WORKFLOW: z.unknown(),
  // App container Durable Object binding (APP_CONTAINER)
  APP_CONTAINER: z.unknown(),
  // Rate limiting binding (optional — not present in local dev/test)
  TOKEN_RATE_LIMITER: z.unknown().optional(),
  // Hyperdrive binding for the dedicated OSM/trail Postgres instance.
  // When present, its connectionString overrides OSM_DATABASE_URL at runtime.
  OSM_HYPERDRIVE: z.unknown().optional(),
  // Better Auth KV namespace for session storage and rate limiting
  AUTH_KV: z.unknown(),
  // D1 database for query metrics (edge-local, no Neon egress for observability writes)
  METRICS_DB: z.unknown(),
});

export const apiEnvSchema = apiEnvObjectSchema;

// Relaxed schema for test environments
const testEnvSchema = apiEnvObjectSchema.partial().extend({
  ENVIRONMENT: z.enum(['development', 'production']).default('development'),
  SENTRY_DSN: z.string().url().optional().default('https://test@test.ingest.sentry.io/test'),
  NEON_DATABASE_URL: z.string().optional().default('postgres://user:pass@localhost/db'),
  NEON_DATABASE_URL_READONLY: z.string().optional().default('postgres://user:pass@localhost/db'),
  OSM_DATABASE_URL: z.string().url().optional().default('postgres://user:pass@localhost/db'),
  BETTER_AUTH_SECRET: z.string().optional().default('test-better-auth-secret-32-chars-long!!'),
  BETTER_AUTH_URL: z.string().url().optional().default('http://localhost:8787'),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  CF_VERSION_METADATA: z.unknown().optional().default({ id: 'test-version' }),
  AI: z.unknown().optional(),
  PACKRAT_SCRAPY_BUCKET: z.unknown().optional(),
  PACKRAT_BUCKET: z.unknown().optional(),
  PACKRAT_GUIDES_BUCKET: z.unknown().optional(),
  ETL_QUEUE: z.unknown().optional(),
  LOGS_QUEUE: z.unknown().optional(),
  EMBEDDINGS_QUEUE: z.unknown().optional(),
  ETL_WORKFLOW: z.unknown().optional(),
  APP_CONTAINER: z.unknown().optional(),
  AUTH_KV: z.unknown().optional(),
  METRICS_DB: z.unknown().optional(),
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
  | 'ETL_WORKFLOW'
  | 'APP_CONTAINER'
  | 'TOKEN_RATE_LIMITER'
  | 'AUTH_KV'
  | 'METRICS_DB'
> & {
  CF_VERSION_METADATA: WorkerVersionMetadata;
  AI: Ai;
  PACKRAT_SCRAPY_BUCKET: R2Bucket;
  PACKRAT_BUCKET: R2Bucket;
  PACKRAT_GUIDES_BUCKET: R2Bucket;
  ETL_QUEUE: Queue;
  LOGS_QUEUE: Queue;
  EMBEDDINGS_QUEUE: Queue;
  ETL_WORKFLOW: Workflow;
  APP_CONTAINER: DurableObjectNamespace<Container<unknown>>;
  TOKEN_RATE_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
  OSM_HYPERDRIVE?: Hyperdrive;
  AUTH_KV: KVNamespace;
  METRICS_DB?: D1Database;
};

export type Env = ValidatedEnv;

// Cache for validated envs keyed by the raw env reference.
const envCache = new WeakMap<object, ValidatedEnv>();

function isTestEnvironment(rawEnv?: Record<string, unknown>): boolean {
  return (
    rawEnv?.NODE_ENV === 'test' ||
    rawEnv?.VITEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    (typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { __vitest__?: unknown }).__vitest__ !== undefined)
  );
}

function validate(rawEnv: Record<string, unknown>): ValidatedEnv {
  const schema = isTestEnvironment(rawEnv) ? testEnvSchema : apiEnvSchema;
  const validated = schema.safeParse(rawEnv);
  if (!validated.success) {
    throw new Error(`Invalid environment variables: ${validated.error.message}`);
  }

  return {
    ...validated.data,
    CF_VERSION_METADATA: (rawEnv.CF_VERSION_METADATA ??
      validated.data.CF_VERSION_METADATA) as WorkerVersionMetadata, // safe-cast: Cloudflare Worker binding injected by runtime
    AI: (rawEnv.AI ?? validated.data.AI) as Ai, // safe-cast: Cloudflare Worker binding injected by runtime
    PACKRAT_SCRAPY_BUCKET: (rawEnv.PACKRAT_SCRAPY_BUCKET ??
      validated.data.PACKRAT_SCRAPY_BUCKET) as R2Bucket, // safe-cast: Cloudflare Worker binding injected by runtime
    PACKRAT_BUCKET: (rawEnv.PACKRAT_BUCKET ?? validated.data.PACKRAT_BUCKET) as R2Bucket, // safe-cast: Cloudflare Worker binding injected by runtime
    PACKRAT_GUIDES_BUCKET: (rawEnv.PACKRAT_GUIDES_BUCKET ??
      validated.data.PACKRAT_GUIDES_BUCKET) as R2Bucket, // safe-cast: Cloudflare Worker binding injected by runtime
    ETL_QUEUE: (rawEnv.ETL_QUEUE ?? validated.data.ETL_QUEUE) as Queue, // safe-cast: Cloudflare Worker binding injected by runtime
    LOGS_QUEUE: (rawEnv.LOGS_QUEUE ?? validated.data.LOGS_QUEUE) as Queue, // safe-cast: Cloudflare Worker binding injected by runtime
    EMBEDDINGS_QUEUE: (rawEnv.EMBEDDINGS_QUEUE ?? validated.data.EMBEDDINGS_QUEUE) as Queue, // safe-cast: Cloudflare Worker binding injected by runtime
    ETL_WORKFLOW: (rawEnv.ETL_WORKFLOW ?? validated.data.ETL_WORKFLOW) as Workflow, // safe-cast: Cloudflare Worker binding injected by runtime
    // safe-cast: Cloudflare Worker binding injected by runtime
    APP_CONTAINER: (rawEnv.APP_CONTAINER ?? validated.data.APP_CONTAINER) as DurableObjectNamespace<
      Container<unknown>
    >,
    TOKEN_RATE_LIMITER: rawEnv.TOKEN_RATE_LIMITER as ValidatedEnv['TOKEN_RATE_LIMITER'] | undefined, // safe-cast: Cloudflare Worker binding injected by runtime
    OSM_HYPERDRIVE: rawEnv.OSM_HYPERDRIVE as Hyperdrive | undefined, // safe-cast: Cloudflare Worker binding injected by runtime
    AUTH_KV: rawEnv.AUTH_KV as KVNamespace, // safe-cast: Cloudflare Worker binding injected by runtime
    METRICS_DB: rawEnv.METRICS_DB as D1Database, // safe-cast: Cloudflare Worker binding injected by runtime
  } as ValidatedEnv; // safe-cast: all fields have been individually assigned above with correct runtime binding types
}

/**
 * Module-level cache of the Cloudflare Worker env bindings. Primed once per
 * isolate by the entry point (`src/index.ts`).
 */
let cachedRawEnv: Record<string, unknown> | undefined;

function getRawEnv(): Record<string, unknown> {
  if (cachedRawEnv) return cachedRawEnv;

  // safe-cast: accessing arbitrary Cloudflare Worker isolate env property injected at runtime
  const primed = (globalThis as Record<string, unknown>).__cfWorkersEnv__;
  if (isObject(primed)) {
    cachedRawEnv = primed as Record<string, unknown>; // safe-cast: isObject confirmed above
    return cachedRawEnv;
  }

  // Test / Node fallback
  cachedRawEnv = { ...process.env } as Record<string, unknown>; // safe-cast: widening to generic env dict
  return cachedRawEnv;
}

/**
 * Called from the Cloudflare Worker fetch/queue handler to prime the isolate
 * env cache before any downstream code runs.
 */
export function setWorkerEnv(rawEnv: Record<string, unknown>): void {
  cachedRawEnv = rawEnv;
  // safe-cast: storing rawEnv on globalThis for cross-request access in the Worker isolate
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
