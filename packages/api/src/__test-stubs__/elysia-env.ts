/**
 * Stub for elysia's internal env module — used only in the integration-test
 * (vitest-pool-workers) environment.
 *
 * Elysia reads `env.ELYSIA_AOT` at `new Elysia()` construction time to decide
 * whether to use `new Function()` (AOT compilation).  In the workerd/QuickJS
 * sandbox used by @cloudflare/vitest-pool-workers, `new Function()` is
 * disallowed outside a request handler, so any module-level `.compile()` call
 * raises `EvalError: Code generation from strings disallowed for this context`.
 *
 * Forcing `ELYSIA_AOT = "false"` makes Elysia fall back to the dynamic
 * (non-eval) handler path without changing production behaviour (wrangler
 * dev / deploy still sees the real `Bun.env`).
 */
export const env: Record<string, string | undefined> = { ELYSIA_AOT: 'false' };
