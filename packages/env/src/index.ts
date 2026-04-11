/**
 * @packrat/env — typed, Zod-validated environment variable shims.
 *
 * Runtime-specific entry points:
 * - `@packrat/env/node` — Node/Bun scripts (default export at root is
 *   the Node shim for convenience; prefer the explicit `/node` path
 *   in new code).
 *
 * Not yet covered here:
 * - Cloudflare Worker API — see `packages/api/src/utils/env-validation.ts`
 * - Expo client (EXPO_PUBLIC_*)
 * - Next.js (apps/landing, apps/guides)
 */

export type { NodeEnv } from './node';
export { __resetNodeEnvCacheForTests, getNodeEnv, nodeEnvSchema, requireNodeEnv } from './node';
