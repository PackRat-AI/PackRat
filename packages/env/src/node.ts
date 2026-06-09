/**
 * Node-runtime environment shim for Node/Bun scripts (analytics CLI,
 * API scripts). Parses `process.env` once at module load using Zod and
 * exports the typed result as `env`.
 *
 * NOTE: this shim is intentionally scoped to Node/Bun scripts. It does
 * NOT cover:
 * - The Cloudflare Worker API (see
 *   `packages/api/src/utils/env-validation.ts` — that uses `c.env` via
 *   Hono, not `process.env`).
 * - Bootstrap/preinstall scripts (e.g. `.github/scripts/configure-deps.ts`)
 *   that run before workspace packages are available — those must read
 *   `process.env` directly.
 *
 * Adding a new variable: declare it on `nodeEnvSchema`, mark it
 * `.optional()` unless every caller genuinely requires it, and prefer
 * narrow types (enums, `.url()`, etc.) over raw `z.string()`.
 */

import { z } from 'zod';

/**
 * Schema for variables commonly read from Node/Bun scripts in the
 * monorepo. Keep this list deliberately small — only add variables
 * that have at least one real caller in the repo.
 */
export const nodeEnvSchema = z.object({
  // ── Runtime / CI ──────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CI: z.string().optional(),
  GITHUB_ACTIONS: z.string().optional(),
  COMPOSE_PROJECT_NAME: z.string().optional(),

  // ── Bun install auth (.github/scripts/configure-deps.ts) ──────────
  PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN: z.string().min(1).optional(),

  // ── Neon / Postgres (packages/api/migrate.ts, seed.ts) ────────────
  NEON_DATABASE_URL: z.string().url().optional(),
  NEON_DATABASE_URL_READONLY: z.string().url().optional(),
  NEON_WS_PROXY: z.string().optional(),
  PACKRAT_PG_POOL_MAX: z.string().regex(/^\d+$/).optional(),
  PACKRAT_USE_NEON_WSPROXY: z.enum(['true', 'false']).optional(),

  // ── OSM trail database (packages/osm-import) ──────────────────────
  // Managed production PostGIS (mirrors OSM_DATABASE_URL in the Worker via Hyperdrive).
  OSM_DATABASE_URL: z.string().url().optional(),
  // Local Docker PostGIS used by osm2pgsql during import (scratch/processing DB).
  OSM_DATABASE_URL_LOCAL: z.string().url().optional(),
  // osm2pgsql node cache in MB — increase for continent-scale imports (e.g. 6000).
  OSM_CACHE_MB: z.string().regex(/^\d+$/).optional(),
  // Import mode: 'create' drops and recreates tables; 'append' applies incremental diffs.
  IMPORT_MODE: z.enum(['create', 'append']).default('create'),

  // ── R2 / S3 credentials (packages/analytics/scripts/smoke-test.ts) ─
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_ENDPOINT_URL: z.string().url().optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: z.string().min(1).optional(),
  PACKRAT_ITEMS_BUCKET_R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_CATALOG_TOKEN: z.string().min(1).optional(),
  R2_CATALOG_URI: z.string().min(1).optional(),
  R2_WAREHOUSE_NAME: z.string().min(1).optional(),

  // ── API container (packages/api/container_src/server.ts) ──────────
  GOOGLE_GENAI_API_KEY: z.string().min(1).optional(),
  CLOUDFLARE_CONTAINER_ID: z.string().optional(),
  PORT: z.string().regex(/^\d+$/, 'PORT must be a numeric string').optional(),

  // ── Test runner flags ─────────────────────────────────────────────
  VITEST: z.string().optional(),

  // ── PackRat API (CLI base URL override) ───────────────────────────
  PACKRAT_API_URL: z.string().url().optional(),

  // ── Debug / verbose ───────────────────────────────────────────────
  DEBUG: z.string().optional(),

  // ── E2E test credentials ──────────────────────────────────────────
  E2E_TEST_EMAIL: z.string().email().optional(),
  E2E_TEST_PASSWORD: z.string().min(1).optional(),

  // ── OpenAI (packages/api/src/db/seed-e2e-catalog.ts) ──────────────
  OPENAI_API_KEY: z.string().min(1).optional(),
  E2E_API_URL: z.string().url().optional(),
  E2E_DB_URL: z.string().url().optional(),
  E2E_DB_PORT: z.string().regex(/^\d+$/, 'E2E_DB_PORT must be a numeric string').optional(),
  E2E_EXPO_PUBLIC_API_URL: z.string().url().optional(),
  E2E_KV_PERSIST_DIR: z.string().min(1).optional(),
  E2E_VARS: z.string().min(1).optional(),
  APP_ID: z.string().min(1).optional(),
  TEST_EMAIL: z.string().email().optional(),
  TEST_PASSWORD: z.string().min(1).optional(),
  TRIP_NAME: z.string().min(1).optional(),
  PACK_NAME: z.string().min(1).optional(),
  METRO_HOST: z.string().min(1).optional(),
  DEFAULT_METRO_HOST: z.string().min(1).optional(),
  METRO_PORT: z.string().regex(/^\d+$/, 'METRO_PORT must be a numeric string').optional(),
  EXPO_PUBLIC_DISABLE_LOGBOX: z.enum(['true', 'false']).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
});

export type NodeEnv = z.infer<typeof nodeEnvSchema>;

/**
 * Typed env parsed from `process.env` at module load. Throws a Zod
 * validation error if any value fails its schema constraint.
 */
export const nodeEnv = nodeEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  CI: process.env.CI,
  GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
  COMPOSE_PROJECT_NAME: process.env.COMPOSE_PROJECT_NAME,
  PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN: process.env.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN,
  NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
  NEON_DATABASE_URL_READONLY: process.env.NEON_DATABASE_URL_READONLY,
  NEON_WS_PROXY: process.env.NEON_WS_PROXY,
  PACKRAT_PG_POOL_MAX: process.env.PACKRAT_PG_POOL_MAX,
  PACKRAT_USE_NEON_WSPROXY: process.env.PACKRAT_USE_NEON_WSPROXY,
  OSM_DATABASE_URL: process.env.OSM_DATABASE_URL,
  OSM_DATABASE_URL_LOCAL: process.env.OSM_DATABASE_URL_LOCAL,
  OSM_CACHE_MB: process.env.OSM_CACHE_MB,
  IMPORT_MODE: process.env.IMPORT_MODE,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT_URL: process.env.R2_ENDPOINT_URL,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: process.env.PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME,
  PACKRAT_ITEMS_BUCKET_R2_BUCKET_NAME: process.env.PACKRAT_ITEMS_BUCKET_R2_BUCKET_NAME,
  R2_CATALOG_TOKEN: process.env.R2_CATALOG_TOKEN,
  R2_CATALOG_URI: process.env.R2_CATALOG_URI,
  R2_WAREHOUSE_NAME: process.env.R2_WAREHOUSE_NAME,
  GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
  CLOUDFLARE_CONTAINER_ID: process.env.CLOUDFLARE_CONTAINER_ID,
  PORT: process.env.PORT,
  VITEST: process.env.VITEST,
  PACKRAT_API_URL: process.env.PACKRAT_API_URL,
  DEBUG: process.env.DEBUG,
  E2E_TEST_EMAIL: process.env.E2E_TEST_EMAIL,
  E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  E2E_API_URL: process.env.E2E_API_URL,
  E2E_DB_URL: process.env.E2E_DB_URL,
  E2E_DB_PORT: process.env.E2E_DB_PORT,
  E2E_EXPO_PUBLIC_API_URL: process.env.E2E_EXPO_PUBLIC_API_URL,
  E2E_KV_PERSIST_DIR: process.env.E2E_KV_PERSIST_DIR,
  E2E_VARS: process.env.E2E_VARS,
  APP_ID: process.env.APP_ID,
  TEST_EMAIL: process.env.TEST_EMAIL,
  TEST_PASSWORD: process.env.TEST_PASSWORD,
  TRIP_NAME: process.env.TRIP_NAME,
  PACK_NAME: process.env.PACK_NAME,
  METRO_HOST: process.env.METRO_HOST,
  DEFAULT_METRO_HOST: process.env.DEFAULT_METRO_HOST,
  METRO_PORT: process.env.METRO_PORT,
  EXPO_PUBLIC_DISABLE_LOGBOX: process.env.EXPO_PUBLIC_DISABLE_LOGBOX,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
});
