/**
 * Unit tests for `auth.ts`.
 *
 * The user-facing OAuth flow (parseAuthRequest → /login → /callback) requires
 * a live Better Auth backend and the `env.OAUTH_PROVIDER` helper binding —
 * those code paths are covered by the integration suite in U17. This file
 * focuses on what *can* be exercised without a live Worker pool:
 *
 *   - `dcrRegisterGate`: the bearer gate that fronts `POST /register`. This
 *     is the load-bearing piece of U4 and the one most likely to regress
 *     into "DCR is open to the public" if a future refactor flips the
 *     fail-closed default. The tests assert each rejection path and the
 *     pass-through behavior in detail.
 *   - The static health-check branch of `PackRatAuthHandler.fetch`, which
 *     has no external dependencies and exercises the `ServiceMeta` wiring.
 *
 * The route fallthrough (a 404 from a path the handler doesn't own) is also
 * smoke-tested.
 */

import { describe, expect, it } from 'vitest';
import { dcrRegisterGate, PackRatAuthHandler } from '../auth';
import type { Env } from '../types';

/** Build a minimal `Env` for tests. The OAuth helpers are stubbed because
 *  `/register` is intercepted before any OAuthProvider machinery runs. */
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    PackRatMCP: {} as Env['PackRatMCP'],
    PACKRAT_API_URL: 'https://api.test',
    OAUTH_KV: {} as Env['OAUTH_KV'],
    OAUTH_PROVIDER: {} as Env['OAUTH_PROVIDER'],
    ...overrides,
  };
}

function makeRegisterRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://mcp.packratai.com/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      client_name: 'Test',
    }),
  });
}

describe('dcrRegisterGate', () => {
  it('returns null for non-/register paths so they fall through to OAuthProvider', () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'secret' });
    for (const path of ['/', '/health', '/mcp', '/authorize', '/token', '/callback']) {
      const req = new Request(`https://mcp.packratai.com${path}`, {
        headers: { Authorization: 'Bearer secret' },
      });
      expect(dcrRegisterGate(req, env), `path ${path} must fall through`).toBeNull();
    }
  });

  it('rejects POST /register when no Authorization header is present (401 + WWW-Authenticate)', async () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'secret' });
    const res = dcrRegisterGate(makeRegisterRequest(), env);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
    const wwwAuth = res?.headers.get('WWW-Authenticate');
    expect(wwwAuth).toContain('Bearer ');
    expect(wwwAuth).toContain('resource_metadata=');
    const body = (await res?.json()) as { error: string; error_description: string };
    expect(body.error).toBe('invalid_token');
    expect(body.error_description).toMatch(/initial access token/i);
  });

  it('rejects POST /register when the Bearer token does not match (401)', async () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'expected' });
    const res = dcrRegisterGate(makeRegisterRequest({ Authorization: 'Bearer wrong-token' }), env);
    expect(res?.status).toBe(401);
    const body = (await res?.json()) as { error_description: string };
    expect(body.error_description).toMatch(/invalid initial access token/i);
  });

  it('rejects POST /register when the Authorization scheme is not Bearer', async () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'secret' });
    const res = dcrRegisterGate(makeRegisterRequest({ Authorization: 'Basic dXNlcjpwYXNz' }), env);
    expect(res?.status).toBe(401);
    const body = (await res?.json()) as { error_description: string };
    expect(body.error_description).toMatch(/initial access token/i);
  });

  it('rejects POST /register when Bearer has no token value', () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'secret' });
    const res = dcrRegisterGate(makeRegisterRequest({ Authorization: 'Bearer    ' }), env);
    expect(res?.status).toBe(401);
  });

  it('fails closed when MCP_INITIAL_ACCESS_TOKEN is unset (401, even with a Bearer header)', async () => {
    const env = makeEnv(); // no MCP_INITIAL_ACCESS_TOKEN
    const res = dcrRegisterGate(makeRegisterRequest({ Authorization: 'Bearer anything' }), env);
    expect(res?.status).toBe(401);
    const body = (await res?.json()) as { error_description: string };
    expect(body.error_description).toMatch(/disabled/i);
  });

  it('fails closed when MCP_INITIAL_ACCESS_TOKEN is the empty string', () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: '' });
    const res = dcrRegisterGate(makeRegisterRequest({ Authorization: 'Bearer something' }), env);
    expect(res?.status).toBe(401);
  });

  it('passes through (returns null) when the Bearer token matches MCP_INITIAL_ACCESS_TOKEN', () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'super-secret-123' });
    const res = dcrRegisterGate(
      makeRegisterRequest({ Authorization: 'Bearer super-secret-123' }),
      env,
    );
    expect(res).toBeNull();
  });

  it('accepts the Bearer scheme case-insensitively per RFC 6750', () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'tok' });
    for (const scheme of ['Bearer', 'bearer', 'BEARER', 'BeArEr']) {
      const res = dcrRegisterGate(makeRegisterRequest({ Authorization: `${scheme} tok` }), env);
      expect(res, `scheme=${scheme} must pass through`).toBeNull();
    }
  });

  it('also gates non-POST /register so the env var presence cannot be probed', () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'tok' });
    const req = new Request('https://mcp.packratai.com/register', {
      method: 'GET',
    });
    const res = dcrRegisterGate(req, env);
    expect(res?.status).toBe(401);
  });

  it('rejects an Authorization header that exceeds the inspection cap', () => {
    const env = makeEnv({ MCP_INITIAL_ACCESS_TOKEN: 'tok' });
    // 5000 byte token — well above the 4096 cap.
    const giant = `Bearer ${'a'.repeat(5000)}`;
    const res = dcrRegisterGate(makeRegisterRequest({ Authorization: giant }), env);
    expect(res?.status).toBe(401);
  });
});

describe('PackRatAuthHandler — health endpoint', () => {
  it('responds to GET / with a JSON health summary', async () => {
    const env = makeEnv();
    const req = new Request('https://mcp.packratai.com/');
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      service: string;
      version: string;
      transport: string;
      endpoint: string;
      docs: string;
    };
    expect(body.status).toBe('ok');
    expect(body.endpoint).toBe('/mcp');
    expect(body.docs).toMatch(/^https:\/\//);
  });

  it('responds to GET /health identically to GET /', async () => {
    const env = makeEnv();
    const a = await PackRatAuthHandler.fetch(new Request('https://mcp.packratai.com/'), env);
    const b = await PackRatAuthHandler.fetch(new Request('https://mcp.packratai.com/health'), env);
    expect(await a.json()).toEqual(await b.json());
  });

  it('returns 404 JSON for unknown paths', async () => {
    const env = makeEnv();
    const res = await PackRatAuthHandler.fetch(
      new Request('https://mcp.packratai.com/no-such-path'),
      env,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Not Found');
  });
});
