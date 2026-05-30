/**
 * Unit tests for `auth.ts` (post-U3+U4 — operational endpoints only).
 *
 * After the Better Auth OAuth consolidation cutover, `auth.ts` hosts only
 * the operational surface (`handleHealth`, `handleStatus`). The OAuth state
 * machine — authorize/login/callback/register — moved to the API worker
 * and is exercised by `packages/api/src/auth/__tests__/`. The DCR gate,
 * CSRF helpers, role-lookup bridge, and login form are deleted.
 *
 * This file covers:
 *   - `handleHealth`: probes the upstream API `/health`, caches for 10s,
 *     surfaces a 503 envelope when degraded.
 *   - `handleStatus`: static metadata (version, scopes, commit SHA, brand
 *     URLs). No probe; no cache.
 */

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { __resetHealthCacheForTests, handleHealth, handleStatus } from '../auth';
import type { Env } from '../types';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    PackRatMCP: {} as Env['PackRatMCP'],
    PACKRAT_API_URL: 'https://api.test',
    ...overrides,
  };
}

interface HealthProbeBody {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  transport: string;
  endpoint: string;
  docs: string;
  terms: string;
  privacy: string;
  support: string;
  probes: { api: 'ok' | 'down' };
}

// ── /health ─────────────────────────────────────────────────────────────────

describe('handleHealth', () => {
  let fetchSpy: MockInstance<typeof fetch>;
  beforeEach(() => {
    __resetHealthCacheForTests();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    __resetHealthCacheForTests();
  });

  it('returns 200 + status=ok when the API probe succeeds', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    const res = await handleHealth(new Request('https://mcp.packratai.com/health'), makeEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthProbeBody;
    expect(body.status).toBe('ok');
    expect(body.probes.api).toBe('ok');
    expect(body.service).toBe('packrat-mcp');
    // Hits the API's root `/health`, NOT `/api/health`.
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns 503 + status=degraded when the API probe returns 500', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 500 }));
    const res = await handleHealth(new Request('https://mcp.packratai.com/health'), makeEnv());
    expect(res.status).toBe(503);
    const body = (await res.json()) as HealthProbeBody;
    expect(body.status).toBe('degraded');
    expect(body.probes.api).toBe('down');
  });

  it('returns 503 + status=degraded when the API probe throws', async () => {
    fetchSpy.mockRejectedValue(new Error('network unreachable'));
    const res = await handleHealth(new Request('https://mcp.packratai.com/health'), makeEnv());
    expect(res.status).toBe(503);
    const body = (await res.json()) as HealthProbeBody;
    expect(body.probes.api).toBe('down');
  });

  it('caches the result for 10s within a single isolate', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    await handleHealth(new Request('https://mcp.packratai.com/health'), makeEnv());
    await handleHealth(new Request('https://mcp.packratai.com/health'), makeEnv());
    await handleHealth(new Request('https://mcp.packratai.com/health'), makeEnv());
    // 3 calls, 1 upstream probe — cache hits on the next two.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces the brand-aligned legal/support URLs on the body', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    const res = await handleHealth(new Request('https://mcp.packratai.com/health'), makeEnv());
    const body = (await res.json()) as HealthProbeBody;
    expect(body.docs).toBe('https://packratai.com/mcp');
    expect(body.terms).toBe('https://packratai.com/terms-of-service');
    expect(body.privacy).toBe('https://packratai.com/privacy-policy');
    expect(body.support).toBe('mailto:hello@packratai.com');
  });
});

// ── /status ─────────────────────────────────────────────────────────────────

describe('handleStatus', () => {
  it('returns the public-safe metadata block (no probes, no upstream calls)', async () => {
    const res = handleStatus(new Request('https://mcp.packratai.com/status'), makeEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      service: string;
      version: string;
      transport: string;
      endpoint: string;
      scopes_supported: string[];
      docs: string;
      terms: string;
      privacy: string;
      support: string;
      commitSha: string;
    };
    expect(body.service).toBe('packrat-mcp');
    expect(body.transport).toBe('streamable-http');
    expect(body.endpoint).toBe('/mcp');
    expect(body.scopes_supported).toEqual(['mcp', 'mcp:read', 'mcp:write', 'mcp:admin']);
    expect(body.commitSha).toBe('unknown'); // sentinel when MCP_COMMIT_SHA is unset
  });

  it('surfaces MCP_COMMIT_SHA verbatim when bound', async () => {
    const res = handleStatus(
      new Request('https://mcp.packratai.com/status'),
      makeEnv({ MCP_COMMIT_SHA: 'abc1234' }),
    );
    const body = (await res.json()) as { commitSha: string };
    expect(body.commitSha).toBe('abc1234');
  });

  it('never includes any internal/binding identifiers', async () => {
    const res = handleStatus(
      new Request('https://mcp.packratai.com/status'),
      makeEnv({ MCP_COMMIT_SHA: 'abc1234' }),
    );
    const text = await res.clone().text();
    expect(text).not.toContain('api.test'); // PACKRAT_API_URL must not leak
    expect(text).not.toContain('PACKRAT_API_URL');
    expect(text).not.toContain('PackRatMCP');
  });
});
