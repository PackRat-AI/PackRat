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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  betterAuthErrorCopy,
  checkLoginRateLimit,
  dcrRegisterGate,
  PackRatAuthHandler,
} from '../auth';
import { applyCorsHeaders } from '../cors';
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
      terms: string;
      privacy: string;
      support: string;
    };
    expect(body.status).toBe('ok');
    expect(body.endpoint).toBe('/mcp');
    expect(body.docs).toMatch(/^https:\/\//);
    // U12: terms + privacy + support are reviewer-facing requirements per
    // Anthropic's Software Directory Policy. All URLs land on packratai.com
    // (the canonical brand domain); support is the mailto we surface from
    // the listing as well.
    expect(body.terms).toBe('https://packratai.com/terms-of-service');
    expect(body.privacy).toBe('https://packratai.com/privacy-policy');
    expect(body.support).toBe('mailto:hello@packratai.com');
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

// ─── U13: /favicon.ico (Anthropic domain-ownership probe) ────────────────────
//
// Anthropic verifies that the OAuth host serves a favicon as part of intake.
// The probe hits `mcp.packratai.com/favicon.ico` directly — not the landing
// site at `packratai.com` — so the handler has to own the route. The body /
// content-type / cache-control coverage of the embedded payload lives in
// `favicon.test.ts`; here we only check that the route table dispatches to
// `faviconResponse` and not to the 404 fallthrough.
describe('PackRatAuthHandler — /favicon.ico (U13)', () => {
  it('serves a 200 image/x-icon at /favicon.ico', async () => {
    const env = makeEnv();
    const res = await PackRatAuthHandler.fetch(
      new Request('https://mcp.packratai.com/favicon.ico'),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/x-icon');
  });
});

// ─── U6: login security ───────────────────────────────────────────────────────
//
// The full /login POST flow needs a real KV namespace + Better Auth backend,
// which is integration-test territory (U17). Here we build a minimal
// in-memory KV stub and stub `fetch` so each branch of the handler — Origin
// check, CSRF triple-check, Better Auth status mapping — can be exercised
// without touching the network. The KV-bound CSRF anchor is the
// load-bearing piece; the test names call out which check is being
// targeted so a future refactor that collapses any branch into another
// regresses visibly.

interface MockKVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: unknown): Promise<{ keys: { name: string }[] }>;
}

function makeKv(initial: Record<string, string> = {}): MockKVNamespace {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: [...store.keys()].map((name) => ({ name })) };
    },
  };
}

function makeLoginPostRequest(opts: {
  state?: string;
  csrfField?: string;
  csrfCookie?: string | null;
  origin?: string | null;
  email?: string;
  password?: string;
  url?: string;
}): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (opts.origin !== null && opts.origin !== undefined) {
    headers.Origin = opts.origin;
  }
  if (opts.csrfCookie !== null && opts.csrfCookie !== undefined) {
    headers.Cookie = `__Host-PR_CSRF=${opts.csrfCookie}`;
  }

  const params = new URLSearchParams();
  if (opts.email !== undefined) params.set('email', opts.email);
  if (opts.password !== undefined) params.set('password', opts.password);
  if (opts.state !== undefined) params.set('state', opts.state);
  if (opts.csrfField !== undefined) params.set('csrf', opts.csrfField);

  return new Request(opts.url ?? 'https://mcp.packratai.com/login', {
    method: 'POST',
    headers,
    body: params.toString(),
  });
}

/**
 * Seed an in-memory KV with an OAuth state entry + a CSRF nonce entry
 * indexed by `state`. Returns the (now-populated) KV stub so the test
 * can assert against it.
 */
function seedAuthorizeState(state: string, csrfNonce: string): MockKVNamespace {
  return makeKv({
    [`oauth_state:${state}`]: JSON.stringify({
      responseType: 'code',
      clientId: 'claude',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      scope: ['mcp'],
      state: 'client-state',
    }),
    [`csrf:${state}`]: csrfNonce,
  });
}

describe('handleLoginPost — Origin validation', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Default: don't hit network — return a 401 so any test that gets past
    // the early checks doesn't accidentally make a real request.
    fetchSpy.mockResolvedValue(new Response(null, { status: 401 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('rejects POST /login with a mismatched Origin (403)', async () => {
    const kv = seedAuthorizeState('s', 'nonce');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'nonce',
      csrfCookie: 'nonce',
      origin: 'https://evil.example',
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(403);
  });

  it('proceeds when Origin matches the production custom domain', async () => {
    const kv = seedAuthorizeState('s', 'nonce');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ session: { token: 'tok' }, user: { id: 'u1' } }), {
        status: 200,
      }),
    );
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'nonce',
      csrfCookie: 'nonce',
      origin: 'https://mcp.packratai.com',
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    // 302 means we reached the success path (redirect to /callback).
    expect(res.status).toBe(302);
  });

  it('proceeds when Origin is missing (back-compat for non-browser MCP clients)', async () => {
    const kv = seedAuthorizeState('s', 'nonce');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ session: { token: 'tok' }, user: { id: 'u1' } }), {
        status: 200,
      }),
    );
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'nonce',
      csrfCookie: 'nonce',
      origin: null,
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(302);
  });

  it('proceeds when Origin equals the request URL origin (dev workers.dev fallback)', async () => {
    const kv = seedAuthorizeState('s', 'nonce');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ session: { token: 'tok' }, user: { id: 'u1' } }), {
        status: 200,
      }),
    );
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'nonce',
      csrfCookie: 'nonce',
      origin: 'https://packrat-mcp-dev.example.workers.dev',
      url: 'https://packrat-mcp-dev.example.workers.dev/login',
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(302);
  });
});

describe('handleLoginPost — CSRF', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ session: { token: 'tok' }, user: { id: 'u1' } }), {
        status: 200,
      }),
    );
  });
  afterEach(() => fetchSpy.mockRestore());

  it('rejects POST when CSRF cookie and form field do not match (400)', async () => {
    const kv = seedAuthorizeState('s', 'nonce');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'nonce',
      csrfCookie: 'different-nonce',
      origin: 'https://mcp.packratai.com',
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toMatch(/CSRF check failed/i);
  });

  it('rejects POST when no cookie is present (400)', async () => {
    const kv = seedAuthorizeState('s', 'nonce');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'nonce',
      csrfCookie: null,
      origin: 'https://mcp.packratai.com',
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toMatch(/CSRF check failed/i);
  });

  it('rejects POST when cookie is set but the KV entry is missing (load-bearing)', async () => {
    // KV has no `csrf:s` entry — even though the cookie and form match,
    // the KV-bound anchor is missing so the request must fail. This is the
    // critical defense per doc-review F5: a pure double-submit cookie
    // could be forged by a subdomain XSS, so we anchor on KV.
    const kv = makeKv({
      'oauth_state:s': JSON.stringify({
        responseType: 'code',
        clientId: 'claude',
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        scope: ['mcp'],
        state: 'client-state',
      }),
    });
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'nonce',
      csrfCookie: 'nonce',
      origin: 'https://mcp.packratai.com',
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toMatch(/CSRF check failed/i);
  });

  it('rejects POST when the form field matches the KV value but the cookie does not (cookie missing)', async () => {
    // Asserting that ALL three values must be present and equal — not
    // just any two of them.
    const kv = seedAuthorizeState('s', 'nonce');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'nonce',
      csrfCookie: null,
      origin: 'https://mcp.packratai.com',
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('accepts POST when cookie, form field, and KV all match', async () => {
    const kv = seedAuthorizeState('s', 'matching-nonce');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'matching-nonce',
      csrfCookie: 'matching-nonce',
      origin: 'https://mcp.packratai.com',
      email: 'a@b.c',
      password: 'pw',
    });
    const res = await PackRatAuthHandler.fetch(req, env);
    expect(res.status).toBe(302);
  });
});

describe('betterAuthErrorCopy — Better Auth response mapping', () => {
  it('maps 429 to a rate-limit-specific message and 429 status', () => {
    const copy = betterAuthErrorCopy(429);
    expect(copy.status).toBe(429);
    expect(copy.message).toMatch(/too many/i);
  });

  it('maps 423 to a locked-account-specific message and 423 status', () => {
    const copy = betterAuthErrorCopy(423);
    expect(copy.status).toBe(423);
    expect(copy.message).toMatch(/locked/i);
  });

  it('maps 401 to the canonical credentials error and 401 status', () => {
    const copy = betterAuthErrorCopy(401);
    expect(copy.status).toBe(401);
    expect(copy.message).toMatch(/invalid email or password/i);
  });

  it('collapses other 4xx (400/403) into the credentials error to avoid leaking detail', () => {
    expect(betterAuthErrorCopy(400).status).toBe(401);
    expect(betterAuthErrorCopy(403).status).toBe(401);
    expect(betterAuthErrorCopy(400).message).toMatch(/invalid email or password/i);
  });

  it('maps 5xx to a transient-upstream message and 502 status', () => {
    expect(betterAuthErrorCopy(500).status).toBe(502);
    expect(betterAuthErrorCopy(503).status).toBe(502);
    expect(betterAuthErrorCopy(500).message).toMatch(/temporarily unavailable/i);
  });
});

describe('handleLoginPost — Better Auth status surface', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => fetchSpy.mockRestore());

  async function runWithBetterAuthStatus(status: number): Promise<Response> {
    fetchSpy.mockResolvedValue(new Response(null, { status }));
    const kv = seedAuthorizeState('s', 'n');
    const env = makeEnv({ OAUTH_KV: kv as unknown as Env['OAUTH_KV'] });
    const req = makeLoginPostRequest({
      state: 's',
      csrfField: 'n',
      csrfCookie: 'n',
      origin: 'https://mcp.packratai.com',
      email: 'a@b.c',
      password: 'pw',
    });
    return PackRatAuthHandler.fetch(req, env);
  }

  it('429 from Better Auth surfaces the rate-limit copy', async () => {
    const res = await runWithBetterAuthStatus(429);
    expect(res.status).toBe(429);
    const body = await res.text();
    expect(body).toMatch(/too many sign-in attempts/i);
  });

  it('423 from Better Auth surfaces the locked-account copy', async () => {
    const res = await runWithBetterAuthStatus(423);
    expect(res.status).toBe(423);
    const body = await res.text();
    expect(body).toMatch(/locked/i);
  });

  it('401 from Better Auth surfaces the canonical credentials error', async () => {
    const res = await runWithBetterAuthStatus(401);
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toMatch(/invalid email or password/i);
  });

  it('5xx from Better Auth surfaces the transient-upstream copy with status 502', async () => {
    const res = await runWithBetterAuthStatus(500);
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toMatch(/temporarily unavailable/i);
  });
});

describe('checkLoginRateLimit — U14 binding wired', () => {
  it('returns true when env.MCP_TOOLS_RL is undefined (dev fallback so vitest/wrangler dev never break)', async () => {
    const env = makeEnv();
    expect(await checkLoginRateLimit(env, '1.2.3.4')).toBe(true);
    // Empty IP path: the helper uses a `no-ip` segment internally so the
    // key is still well-formed; the dev fallback still returns true.
    expect(await checkLoginRateLimit(env, '')).toBe(true);
  });

  it('returns the binding success flag when MCP_TOOLS_RL is bound (allowed → true)', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const env = makeEnv({
      MCP_TOOLS_RL: { limit } as unknown as Env['MCP_TOOLS_RL'],
    });
    expect(await checkLoginRateLimit(env, '1.2.3.4')).toBe(true);
    expect(limit).toHaveBeenCalledWith({ key: 'login:1.2.3.4' });
  });

  it('returns false when the binding reports the budget exhausted', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const env = makeEnv({
      MCP_TOOLS_RL: { limit } as unknown as Env['MCP_TOOLS_RL'],
    });
    expect(await checkLoginRateLimit(env, '5.6.7.8')).toBe(false);
    expect(limit).toHaveBeenCalledWith({ key: 'login:5.6.7.8' });
  });

  it('uses a stable "no-ip" segment when the caller IP is empty (no global collapse)', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const env = makeEnv({
      MCP_TOOLS_RL: { limit } as unknown as Env['MCP_TOOLS_RL'],
    });
    await checkLoginRateLimit(env, '');
    // The key still carries the `login:` namespace prefix and a
    // recognizable fallback segment so it doesn't share a counter with
    // every other rate-limited surface.
    expect(limit).toHaveBeenCalledWith({ key: 'login:no-ip' });
  });

  it('fails open (returns true) when the binding itself throws', async () => {
    const limit = vi.fn().mockRejectedValue(new Error('binding down'));
    const env = makeEnv({
      MCP_TOOLS_RL: { limit } as unknown as Env['MCP_TOOLS_RL'],
    });
    // Fail-open is intentional per the rate-limit.ts contract: a
    // transient Cloudflare-side rate-limit-API hiccup must not black-hole
    // legitimate sign-ins.
    expect(await checkLoginRateLimit(env, '1.2.3.4')).toBe(true);
  });
});

// ─── U6: CORS allowlist on /.well-known/* ────────────────────────────────────
//
// applyCorsHeaders is the one place CORS lives — the outer fetch wrapper
// in `index.ts` invokes it for OPTIONS preflights (short-circuiting the
// OAuthProvider entirely) and for GET responses (annotating after the
// provider replies). Default-deny is critical: any origin not in
// WELL_KNOWN_ALLOWED_ORIGINS must see the upstream response unmodified.

describe('applyCorsHeaders — well-known CORS', () => {
  it('returns a 204 preflight with the correct headers for OPTIONS from claude.ai', () => {
    const req = new Request('https://mcp.packratai.com/.well-known/oauth-protected-resource', {
      method: 'OPTIONS',
      headers: { Origin: 'https://claude.ai' },
    });
    const res = applyCorsHeaders(req, null);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(204);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('https://claude.ai');
    expect(res?.headers.get('Vary')).toBe('Origin');
    expect(res?.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res?.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(res?.headers.get('Access-Control-Allow-Headers')).toMatch(/Authorization/i);
    expect(res?.headers.get('Access-Control-Max-Age')).toBe('3600');
  });

  it('returns a 204 preflight for OPTIONS from claude.com (both Anthropic hosts)', () => {
    const req = new Request('https://mcp.packratai.com/.well-known/oauth-authorization-server', {
      method: 'OPTIONS',
      headers: { Origin: 'https://claude.com' },
    });
    const res = applyCorsHeaders(req, null);
    expect(res?.status).toBe(204);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('https://claude.com');
  });

  it('annotates a GET response from claude.ai with Allow-Origin + Vary', () => {
    const req = new Request('https://mcp.packratai.com/.well-known/oauth-protected-resource', {
      method: 'GET',
      headers: { Origin: 'https://claude.ai' },
    });
    const upstream = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const res = applyCorsHeaders(req, upstream);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(200);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('https://claude.ai');
    expect(res?.headers.get('Vary')).toMatch(/Origin/);
    expect(res?.headers.get('Content-Type')).toBe('application/json');
  });

  it('does NOT set Allow-Origin for a GET from a non-allowlisted origin (default-deny)', () => {
    const req = new Request('https://mcp.packratai.com/.well-known/oauth-protected-resource', {
      method: 'GET',
      headers: { Origin: 'https://evil.example' },
    });
    const upstream = new Response('{}', { status: 200 });
    const res = applyCorsHeaders(req, upstream);
    expect(res).toBeNull();
  });

  it('does NOT set Allow-Origin for a non-/.well-known/ path (CORS scope is contained)', () => {
    const req = new Request('https://mcp.packratai.com/mcp', {
      method: 'GET',
      headers: { Origin: 'https://claude.ai' },
    });
    const upstream = new Response('{}', { status: 200 });
    const res = applyCorsHeaders(req, upstream);
    expect(res).toBeNull();
  });

  it('does NOT preflight for OPTIONS from a non-allowlisted origin', () => {
    const req = new Request('https://mcp.packratai.com/.well-known/oauth-protected-resource', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    const res = applyCorsHeaders(req, null);
    expect(res).toBeNull();
  });

  it('handles a GET with no Origin header by returning null (no CORS needed)', () => {
    const req = new Request('https://mcp.packratai.com/.well-known/oauth-protected-resource', {
      method: 'GET',
    });
    const upstream = new Response('{}', { status: 200 });
    const res = applyCorsHeaders(req, upstream);
    expect(res).toBeNull();
  });

  it('preserves any existing Vary header by appending Origin', () => {
    const req = new Request('https://mcp.packratai.com/.well-known/oauth-protected-resource', {
      method: 'GET',
      headers: { Origin: 'https://claude.ai' },
    });
    const upstream = new Response('{}', {
      status: 200,
      headers: { Vary: 'Accept-Encoding' },
    });
    const res = applyCorsHeaders(req, upstream);
    expect(res?.headers.get('Vary')).toBe('Accept-Encoding, Origin');
  });
});
