/**
 * Unit tests for `rate-limit.ts` + the per-user/per-tool gating contract
 * the proxy in `index.ts/installToolRegistrationProxy` is designed to enforce.
 *
 * The `index.ts` proxy itself can't be exercised in a node-native vitest
 * run because instantiating `PackRatMCP` requires the `agents/mcp` module
 * (which pulls `cloudflare:workers`). The proxy + handler-wrap pattern is
 * trivial enough that re-implementing the wrap shape here, against the
 * exported helpers, gives us the load-bearing coverage without an
 * integration test:
 *
 *   - canonical key shape: `${userId}:${toolName}`
 *   - independent counters per user (same tool, different user → independent)
 *   - independent counters per tool (same user, different tool → independent)
 *   - on exceed: the canonical U8 `errResponse('rate_limited', ...)` envelope
 *
 * The proxy installation itself (`wrapHandlerWithRateLimit`) is covered by
 * the integration suite in U17.
 */

import { describe, expect, it, vi } from 'vitest';
import { errResponse, type McpToolResult } from '../client';
import { checkRateLimit, toolRateLimitKey } from '../rate-limit';
import type { Env } from '../types';
import { nth } from './_access';

/** Build a minimal Env with an optional MCP_TOOLS_RL binding. */
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    PackRatMCP: {} as Env['PackRatMCP'],
    PACKRAT_API_URL: 'https://api.test',
    ...overrides,
  };
}

/**
 * Build a mocked rate-limit binding whose `.limit({ key })` returns
 * `{ success }` based on a per-key budget. Records every key passed in
 * so tests can assert the key shape AND the counter independence
 * contract.
 */
function makeMockBinding(perKeyBudget = 60): {
  binding: { limit: ReturnType<typeof vi.fn> };
  counters: Map<string, number>;
  keys: string[];
} {
  const counters = new Map<string, number>();
  const keys: string[] = [];
  const limit = vi.fn(async ({ key }: { key: string }) => {
    keys.push(key);
    const used = counters.get(key) ?? 0;
    if (used >= perKeyBudget) return { success: false };
    counters.set(key, used + 1);
    return { success: true };
  });
  return { binding: { limit }, counters, keys };
}

describe('toolRateLimitKey', () => {
  it('produces the canonical userId-colon-toolName shape (per the K.T.D.)', () => {
    expect(toolRateLimitKey({ userId: 'u_123', toolName: 'packrat_get_pack' })).toBe(
      'u_123:packrat_get_pack',
    );
  });

  it('collapses to a per-tool slot when the userId is empty (defensive fallback)', () => {
    // Post-U3+U4: `userId` comes from the JWT `sub` claim via `verifyMcpToken`
    // and is always populated for an authenticated request. The empty-string
    // case stays covered as a defensive fallback so a future regression that
    // drops `sub` from Props degrades to a shared per-tool counter instead of
    // silently collapsing every user into a single global counter.
    expect(toolRateLimitKey({ userId: '', toolName: 'packrat_get_pack' })).toBe(
      ':packrat_get_pack',
    );
  });
});

// `loginRateLimitKey` tests retired in U6: the /login form was deleted with
// the Better Auth cutover (U3+U4). The helper is still exported for now so
// a future API-worker-side surface can reuse the namespace prefix shape, but
// there is no live MCP-side caller, so the contract tests live with whichever
// surface ends up adopting it.

describe('checkRateLimit — dev fallback', () => {
  it("returns true when env.MCP_TOOLS_RL is undefined (so vitest + wrangler dev don't break)", async () => {
    const env = makeEnv();
    expect(await checkRateLimit({ env, key: 'u:packrat_get_pack' })).toBe(true);
  });
});

describe('checkRateLimit — binding present', () => {
  it('returns the binding success flag (allowed → true)', async () => {
    const { binding } = makeMockBinding();
    const env = makeEnv({
      MCP_TOOLS_RL: binding as unknown as Env['MCP_TOOLS_RL'],
    });
    expect(await checkRateLimit({ env, key: 'u:packrat_get_pack' })).toBe(true);
    expect(binding.limit).toHaveBeenCalledWith({ key: 'u:packrat_get_pack' });
  });

  it('returns false when the binding reports the budget exhausted', async () => {
    const { binding, counters } = makeMockBinding(0);
    counters.set('u:packrat_get_pack', 0); // ensure first call exhausts
    const env = makeEnv({
      MCP_TOOLS_RL: binding as unknown as Env['MCP_TOOLS_RL'],
    });
    expect(await checkRateLimit({ env, key: 'u:packrat_get_pack' })).toBe(false);
  });

  it('fails open (returns true) when the binding throws — never black-holes legit requests', async () => {
    const limit = vi.fn().mockRejectedValue(new Error('rate-limit api down'));
    const env = makeEnv({
      MCP_TOOLS_RL: { limit } as unknown as Env['MCP_TOOLS_RL'],
    });
    // Documented trade-off in rate-limit.ts: a transient Cloudflare-side
    // rate-limit-API outage must not black-hole legitimate requests. U15
    // will add structured observability so we can alert on this volume.
    expect(await checkRateLimit({ env, key: 'u:packrat_get_pack' })).toBe(true);
  });
});

// ─── Per-user / per-tool independence + envelope shape ───────────────────────
//
// These tests model the contract `installToolRegistrationProxy` enforces:
// each tool call passes its `${userId}:${toolName}` key through the binding
// and surfaces the canonical `errResponse('rate_limited', ...)` envelope on
// exceed. Re-implementing the wrap shape against the exported helpers
// keeps the proxy contract testable without dragging the full Worker
// runtime into a node-native suite.

/**
 * Mirror of `wrapHandlerWithRateLimit` in `index.ts`. Built here so the
 * key-shape + envelope contract is testable in a node-native vitest run
 * without instantiating `PackRatMCP` (which would drag in `agents/mcp`
 * and `cloudflare:workers`).
 *
 * Options-object signature so a future contract addition (e.g. a custom
 * key shape per test) lands on this seam rather than forcing a rewrite
 * of every call site.
 */
interface RateLimitedCallArgs {
  env: Env;
  userId: string;
  toolName: string;
  handler: () => Promise<McpToolResult>;
}

async function rateLimitedCall(args: RateLimitedCallArgs): Promise<McpToolResult> {
  const { env, userId, toolName, handler } = args;
  const key = toolRateLimitKey({ userId, toolName });
  const allowed = await checkRateLimit({ env, key });
  if (!allowed) {
    return errResponse({
      code: 'rate_limited',
      message: 'Rate limit exceeded; try again in a moment.',
      retryable: true,
    });
  }
  return handler();
}

describe('rate-limited tool dispatch — envelope', () => {
  it('returns the canonical `rate_limited` errResponse envelope when the binding rejects', async () => {
    // Budget of 0 → every call rejects immediately so we can assert the
    // envelope shape without burning successful invocations first.
    const { binding } = makeMockBinding(0);
    const env = makeEnv({
      MCP_TOOLS_RL: binding as unknown as Env['MCP_TOOLS_RL'],
    });

    const handler = vi.fn().mockResolvedValue({
      content: [{ type: 'text' as const, text: 'should not be called' }],
    });

    const result = await rateLimitedCall({
      env,
      userId: 'u_1',
      toolName: 'packrat_get_pack',
      handler,
    });

    // Tool handler MUST NOT fire on a rejected rate-limit check.
    expect(handler).not.toHaveBeenCalled();

    // U8 envelope contract: isError + structuredContent.error with the
    // canonical `rate_limited` code and retryable=true.
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        code: 'rate_limited',
        message: 'Rate limit exceeded; try again in a moment.',
        retryable: true,
      },
    });
    expect(nth(result.content, 0).text).toMatch(/rate limit exceeded/i);
  });

  it('passes through to the handler when the binding allows', async () => {
    const { binding } = makeMockBinding();
    const env = makeEnv({
      MCP_TOOLS_RL: binding as unknown as Env['MCP_TOOLS_RL'],
    });

    const handler = vi.fn().mockResolvedValue({
      content: [{ type: 'text' as const, text: 'ok' }],
    });

    const result = await rateLimitedCall({
      env,
      userId: 'u_1',
      toolName: 'packrat_get_pack',
      handler,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.isError).toBeUndefined();
    expect(nth(result.content, 0).text).toBe('ok');
    expect(binding.limit).toHaveBeenCalledWith({ key: 'u_1:packrat_get_pack' });
  });
});

describe('rate-limited tool dispatch — per-user independence', () => {
  it('two users hitting the same tool have independent counters', async () => {
    // Budget of 1: each (user, tool) pair gets exactly one success then
    // exhausts. With independent counters, two different users should
    // both succeed once. A shared counter would let only the first
    // through.
    const { binding } = makeMockBinding(1);
    const env = makeEnv({
      MCP_TOOLS_RL: binding as unknown as Env['MCP_TOOLS_RL'],
    });
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: 'text' as const, text: 'ok' }],
    });

    const a = await rateLimitedCall({
      env,
      userId: 'u_A',
      toolName: 'packrat_get_pack',
      handler,
    });
    const b = await rateLimitedCall({
      env,
      userId: 'u_B',
      toolName: 'packrat_get_pack',
      handler,
    });

    expect(a.isError).toBeUndefined();
    expect(b.isError).toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(binding.limit).toHaveBeenNthCalledWith(1, { key: 'u_A:packrat_get_pack' });
    expect(binding.limit).toHaveBeenNthCalledWith(2, { key: 'u_B:packrat_get_pack' });
  });
});

describe('rate-limited tool dispatch — per-tool independence', () => {
  it('one user hitting two different tools has independent counters', async () => {
    const { binding } = makeMockBinding(1);
    const env = makeEnv({
      MCP_TOOLS_RL: binding as unknown as Env['MCP_TOOLS_RL'],
    });
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: 'text' as const, text: 'ok' }],
    });

    const a = await rateLimitedCall({
      env,
      userId: 'u_1',
      toolName: 'packrat_get_pack',
      handler,
    });
    const b = await rateLimitedCall({
      env,
      userId: 'u_1',
      toolName: 'packrat_list_trips',
      handler,
    });

    expect(a.isError).toBeUndefined();
    expect(b.isError).toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(binding.limit).toHaveBeenNthCalledWith(1, { key: 'u_1:packrat_get_pack' });
    expect(binding.limit).toHaveBeenNthCalledWith(2, { key: 'u_1:packrat_list_trips' });
  });

  it('the same (user, tool) pair shares a counter — the 61st call within the window rejects', async () => {
    // The 60/60s production budget would be slow to exercise; we shrink
    // to 3 here to keep the test fast. The contract is identical.
    const { binding } = makeMockBinding(3);
    const env = makeEnv({
      MCP_TOOLS_RL: binding as unknown as Env['MCP_TOOLS_RL'],
    });
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: 'text' as const, text: 'ok' }],
    });

    const r1 = await rateLimitedCall({
      env,
      userId: 'u_1',
      toolName: 'packrat_get_pack',
      handler,
    });
    const r2 = await rateLimitedCall({
      env,
      userId: 'u_1',
      toolName: 'packrat_get_pack',
      handler,
    });
    const r3 = await rateLimitedCall({
      env,
      userId: 'u_1',
      toolName: 'packrat_get_pack',
      handler,
    });
    const r4 = await rateLimitedCall({
      env,
      userId: 'u_1',
      toolName: 'packrat_get_pack',
      handler,
    });

    expect(r1.isError).toBeUndefined();
    expect(r2.isError).toBeUndefined();
    expect(r3.isError).toBeUndefined();
    // 4th call (over the budget of 3) — rejects with the canonical envelope.
    expect(r4.isError).toBe(true);
    expect((r4.structuredContent as { error: { code: string } }).error.code).toBe('rate_limited');
    // Handler fires once per successful pass — never on the rejected call.
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
