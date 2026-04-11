/**
 * Node-runtime environment shim.
 *
 * Use this from Node/Bun scripts (analytics CLI, API scripts,
 * .github/scripts) instead of reaching into `process.env.*` directly.
 *
 * Guarantees:
 * - One parse of `process.env` per process, cached.
 * - Aggregated, human-readable error on invalid/missing required vars.
 * - Typed `env.FOO` access — no `string | undefined` surprises.
 *
 * NOTE: this shim is intentionally scoped to Node/Bun scripts. It does
 * NOT cover:
 * - The Cloudflare Worker API (see
 *   `packages/api/src/utils/env-validation.ts` — that uses `c.env` via
 *   Hono, not `process.env`).
 * - The Expo client (EXPO_PUBLIC_* only, build-time injection).
 * - Next.js (landing, guides) — Next has its own env typing story.
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

  // ── Bun install auth (.github/scripts/configure-deps.ts) ──────────
  PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN: z.string().min(1).optional(),

  // ── Neon / Postgres (packages/api/migrate.ts, seed.ts) ────────────
  NEON_DATABASE_URL: z.string().url().optional(),
  NEON_DATABASE_URL_READONLY: z.string().url().optional(),

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
});

export type NodeEnv = z.infer<typeof nodeEnvSchema>;

let cached: NodeEnv | undefined;

/**
 * Parse `process.env` against `nodeEnvSchema` exactly once per process.
 *
 * Throws an aggregated `Error` that lists every invalid/missing var
 * and why — never silently returns `undefined`.
 */
export function getNodeEnv(): NodeEnv {
  if (cached) return cached;
  const result = nodeEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid Node environment configuration:\n${issues}`);
  }
  cached = result.data;
  return cached;
}

/**
 * Assert that the given variables are present (non-empty) on the
 * parsed env, returning a narrowed object where those keys are
 * guaranteed defined. Throws an aggregated error listing every
 * missing key — preferred over hand-rolled `if (!env.FOO) throw ...`
 * chains at call sites that need several vars at once.
 */
export function requireNodeEnv<K extends keyof NodeEnv>(
  keys: readonly K[],
): NodeEnv & { [P in K]-?: NonNullable<NodeEnv[P]> } {
  const env = getNodeEnv();
  const missing = keys.filter((key) => {
    const value = env[key];
    return value === undefined || value === null || value === '';
  });
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${String(k)}`).join('\n')}`,
    );
  }
  return env as NodeEnv & { [P in K]-?: NonNullable<NodeEnv[P]> };
}

/**
 * Reset the cached parse. Intended for tests only — production code
 * should never need to call this.
 */
export function __resetNodeEnvCacheForTests(): void {
  cached = undefined;
}
