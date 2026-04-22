/**
 * @packrat/env — typed, Zod-validated environment variable shims.
 *
 * Runtime-specific entry points:
 * - `@packrat/env/node` — Node/Bun scripts (default export at root is
 *   the Node shim for convenience; prefer the explicit `/node` path
 *   in new code).
 * - `@packrat/env/next` — Next.js apps (`apps/guides`, `apps/landing`).
 * - `@packrat/env/expo-client` — Expo client bundle (`EXPO_PUBLIC_*` vars).
 * - `@packrat/env/expo-server` — Expo server-only vars (API routes, etc.).
 *
 * Not yet covered here:
 * - Cloudflare Worker API — see `packages/api/src/utils/env-validation.ts`
 */

export type { NodeEnv } from './node';
export { nodeEnv, nodeEnvSchema } from './node';
