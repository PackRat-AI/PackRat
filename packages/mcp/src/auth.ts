/**
 * PackRat MCP OAuth 2.1 authorization handler.
 *
 * Implements the user-facing parts of the OAuth flow:
 *   GET  /authorize → parse OAuth request, redirect to /login
 *   GET  /login     → serve sign-in form
 *   POST /login     → call Better Auth API, store session, redirect to /callback
 *   GET  /callback  → complete authorization, redirect client back with auth code
 *   GET  /          → health check (also /health)
 *
 * Also exports a `dcrRegisterGate(env, request)` helper used by the Worker
 * entrypoint (`index.ts`) to gate `POST /register` on
 * `Authorization: Bearer <MCP_INITIAL_ACCESS_TOKEN>` *before* the
 * `OAuthProvider` dispatch sees the request. The gate fails closed: if the
 * env var is unset, every `/register` is rejected. See U4 of the
 * connector-store readiness plan and `docs/mcp/runbook.md` for the operator
 * flow that pre-registers Claude's callbacks via the one-shot script.
 *
 * KV layout (all keys expire after 10 minutes):
 *   oauth_state:<stateKey>  → JSON-serialised AuthRequest from parseAuthRequest()
 *   session:<stateKey>      → JSON { token: string, userId: string }
 */

import { isString } from '@packrat/guards';
import {
  caseInsensitive,
  createRegExp,
  exactly,
  global as globalFlag,
  oneOrMore,
  whitespace,
} from 'magic-regexp';
import { z } from 'zod';
import { ServiceMeta } from './constants';
import { unauthorizedResponse } from './metadata';
import type { Env, Props } from './types';

// ── HTML-escape regexes (magic-regexp so the pre-push hook is satisfied) ─────
const AMP_RE = createRegExp(exactly('&'), [globalFlag]);
const LT_RE = createRegExp(exactly('<'), [globalFlag]);
const GT_RE = createRegExp(exactly('>'), [globalFlag]);
const QUOT_RE = createRegExp(exactly('"'), [globalFlag]);

// `Authorization: Bearer <prefix>` — case-insensitive scheme, one-or-more
// spaces. Used by `extractBearer` to split the prefix from the token without
// touching the token contents (magic-regexp's strict group typing pushes us
// away from a single-pattern capture for arbitrary opaque values).
const BEARER_PREFIX_RE = createRegExp(exactly('Bearer').and(oneOrMore(whitespace)), [
  caseInsensitive,
]);
// Bound the body of the Authorization header we even bother to inspect.
// Worker header limits cap this around 8 KiB; 4 KiB is plenty for any OAuth
// access or initial-access token shape we expect to see.
const MAX_BEARER_HEADER_LEN = 4096;

// ── Zod schemas for external data ─────────────────────────────────────────────

const OAuthStateSchema = z.object({
  responseType: z.string(),
  clientId: z.string(),
  redirectUri: z.string(),
  scope: z.array(z.string()),
  state: z.string(),
});

const SessionKvSchema = z.object({
  token: z.string(),
  userId: z.string(),
});

const SignInResponseSchema = z.object({
  session: z.object({ token: z.string() }).optional(),
  user: z.object({ id: z.string() }).optional(),
});

// ── KV key helpers ────────────────────────────────────────────────────────────

const STATE_TTL = 600; // 10 minutes in seconds

function oauthStateKey(key: string) {
  return `oauth_state:${key}`;
}
function sessionKey(key: string) {
  return `session:${key}`;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(AMP_RE, '&amp;')
    .replace(LT_RE, '&lt;')
    .replace(GT_RE, '&gt;')
    .replace(QUOT_RE, '&quot;');
}

function loginPage(state: string, error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in · PackRat</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 16px; color: #1a1a1a; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    p.sub { color: #666; margin-bottom: 24px; font-size: .9rem; }
    label { display: block; margin-bottom: 16px; font-size: .9rem; font-weight: 500; }
    input { display: block; width: 100%; box-sizing: border-box; margin-top: 4px; padding: 8px 12px;
            border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
    button { width: 100%; padding: 10px; background: #2563eb; color: white; border: none;
             border-radius: 6px; font-size: 1rem; cursor: pointer; margin-top: 8px; }
    button:hover { background: #1d4ed8; }
    .error { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca;
             border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: .9rem; }
  </style>
</head>
<body>
  <h1>Sign in to PackRat</h1>
  <p class="sub">An MCP client is requesting access to your PackRat account.</p>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  <form method="POST" action="/login">
    <input type="hidden" name="state" value="${escapeHtml(state)}" />
    <label>Email
      <input type="email" name="email" required autocomplete="email" />
    </label>
    <label>Password
      <input type="password" name="password" required autocomplete="current-password" />
    </label>
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
}

/** FormData.get() returns FormDataEntryValue | null (string | File | null). Extract string only. */
function getFormString(data: { get(name: string): string | File | null }, key: string): string {
  const val = data.get(key);
  return isString(val) ? val : '';
}

// ── Dynamic Client Registration gate ──────────────────────────────────────────

/**
 * Extract the bearer token from an `Authorization` header value.
 *
 * Returns `null` if the header is missing, doesn't use the Bearer scheme,
 * the token slot is empty, or the value exceeds `MAX_BEARER_HEADER_LEN`.
 * The length cap defends the comparator from pathological header sizes —
 * Workers will already reject anything > ~8 KiB but we cap earlier so
 * `timingSafeEqual` never sees attacker-chosen multi-MB inputs.
 */
function extractBearer(headerValue: string | null): string | null {
  if (!headerValue) return null;
  if (headerValue.length > MAX_BEARER_HEADER_LEN) return null;
  const match = BEARER_PREFIX_RE.exec(headerValue);
  if (!match || match.index !== 0) return null;
  const token = headerValue.slice(match[0].length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Constant-time string equality. Returns false on any length mismatch and
 * compares byte-by-byte without short-circuit so an attacker can't probe
 * the secret one character at a time via timing.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Gate for `POST /register` (RFC 7591 Dynamic Client Registration).
 *
 * The `@cloudflare/workers-oauth-provider` library does not natively support
 * initial-access-token gating; without this check, anyone who can reach the
 * Worker URL can mint OAuth clients. We intercept the request *before*
 * `OAuthProvider.fetch()` dispatches it, validate the bearer against
 * `env.MCP_INITIAL_ACCESS_TOKEN`, and only let valid callers fall through
 * to the library's `handleClientRegistration` (which preserves the spec
 * response shape: `client_id`, optional `client_secret`,
 * `registration_client_uri`, etc.).
 *
 * Fail-closed semantics:
 *   - Missing `Authorization` header                  → 401
 *   - `Authorization` not Bearer scheme               → 401
 *   - Token mismatch                                  → 401
 *   - `MCP_INITIAL_ACCESS_TOKEN` env var unset/empty  → 401 (DCR effectively disabled)
 *
 * All 401s carry the same `WWW-Authenticate: Bearer resource_metadata=...`
 * header as `/mcp`, so an MCP client receiving the error can rediscover
 * the protected-resource metadata in one round trip.
 *
 * Returns a `Response` to short-circuit dispatch, or `null` if the request
 * should proceed to the normal `OAuthProvider` routing.
 */
export function dcrRegisterGate(request: Request, env: Env): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== '/register') return null;
  // Method check is left to OAuthProvider (it returns 405 for non-POST).
  // We still apply the bearer gate to non-POST so a GET probe can't be used
  // to fingerprint whether the env var is set.

  const expected = env.MCP_INITIAL_ACCESS_TOKEN;
  if (!expected || expected.length === 0) {
    return unauthorizedResponse(env, 'Dynamic client registration is disabled on this server');
  }

  const provided = extractBearer(request.headers.get('Authorization'));
  if (!provided) {
    return unauthorizedResponse(
      env,
      'Dynamic client registration requires an initial access token',
    );
  }

  if (!timingSafeEqual(provided, expected)) {
    return unauthorizedResponse(env, 'Invalid initial access token');
  }

  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const PackRatAuthHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check (replaced with a real probing version in U16).
    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: ServiceMeta.Name,
        version: ServiceMeta.Version,
        transport: ServiceMeta.Transport,
        endpoint: '/mcp',
        docs: 'https://packratai.com/mcp',
      });
    }

    if (url.pathname === '/authorize') {
      return handleAuthorize(request, env);
    }

    if (url.pathname === '/login') {
      return request.method === 'POST' ? handleLoginPost(request, env) : handleLoginGet(request);
    }

    if (url.pathname === '/callback') {
      return handleCallback(request, env);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
};

// ── /authorize ────────────────────────────────────────────────────────────────

async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  let oauthReq: z.infer<typeof OAuthStateSchema>;
  try {
    const parsed = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    const result = OAuthStateSchema.safeParse(parsed);
    if (!result.success) throw new Error('Invalid OAuth request');
    oauthReq = result.data;
  } catch {
    return Response.json(
      { error: 'invalid_request', error_description: 'Malformed authorization request' },
      { status: 400 },
    );
  }

  const stateKey = crypto.randomUUID();
  await env.OAUTH_KV.put(oauthStateKey(stateKey), JSON.stringify(oauthReq), {
    expirationTtl: STATE_TTL,
  });

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('state', stateKey);
  return Response.redirect(loginUrl.toString(), 302);
}

// ── /login GET ────────────────────────────────────────────────────────────────

function handleLoginGet(request: Request): Response {
  const state = new URL(request.url).searchParams.get('state') ?? '';
  return new Response(loginPage(state), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ── /login POST ───────────────────────────────────────────────────────────────

async function handleLoginPost(request: Request, env: Env): Promise<Response> {
  let email: string;
  let password: string;
  let state: string;

  try {
    const form = await request.formData();
    email = getFormString(form, 'email');
    password = getFormString(form, 'password');
    state = getFormString(form, 'state');
  } catch {
    return new Response(loginPage('', 'Invalid form submission.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!email || !password || !state) {
    return new Response(loginPage(state, 'Email and password are required.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const oauthReqStr = await env.OAUTH_KV.get(oauthStateKey(state));
  if (!oauthReqStr) {
    return new Response(loginPage(state, 'Session expired. Please start over.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  let signInRes: Response;
  try {
    signInRes = await fetch(`${env.PACKRAT_API_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return new Response(loginPage(state, 'Could not reach PackRat. Try again.'), {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!signInRes.ok) {
    return new Response(loginPage(state, 'Invalid email or password.'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const signInResult = SignInResponseSchema.safeParse(await signInRes.json().catch(() => null));
  const betterAuthToken = signInResult.success ? signInResult.data.session?.token : undefined;
  const userId = signInResult.success ? signInResult.data.user?.id : undefined;

  if (!betterAuthToken || !userId) {
    return new Response(loginPage(state, 'Sign-in succeeded but session data was missing.'), {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  await env.OAUTH_KV.put(sessionKey(state), JSON.stringify({ token: betterAuthToken, userId }), {
    expirationTtl: STATE_TTL,
  });

  const callbackUrl = new URL('/callback', request.url);
  callbackUrl.searchParams.set('state', state);
  return Response.redirect(callbackUrl.toString(), 302);
}

// ── /callback ─────────────────────────────────────────────────────────────────

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const state = new URL(request.url).searchParams.get('state') ?? '';

  const [oauthReqStr, sessionStr] = await Promise.all([
    env.OAUTH_KV.get(oauthStateKey(state)),
    env.OAUTH_KV.get(sessionKey(state)),
  ]);

  if (!oauthReqStr || !sessionStr) {
    return Response.json(
      { error: 'invalid_request', error_description: 'Invalid or expired state' },
      { status: 400 },
    );
  }

  const oauthReqResult = OAuthStateSchema.safeParse(JSON.parse(oauthReqStr));
  const sessionResult = SessionKvSchema.safeParse(JSON.parse(sessionStr));

  if (!oauthReqResult.success || !sessionResult.success) {
    return Response.json(
      { error: 'invalid_request', error_description: 'Corrupted state data' },
      { status: 400 },
    );
  }

  const oauthReq = oauthReqResult.data;
  const { token: betterAuthToken, userId } = sessionResult.data;

  // Clean up KV state (best-effort)
  void Promise.all([
    env.OAUTH_KV.delete(oauthStateKey(state)),
    env.OAUTH_KV.delete(sessionKey(state)),
  ]);

  const props: Props = { betterAuthToken, userId };

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReq,
    userId,
    metadata: {},
    scope: oauthReq.scope,
    props,
  });

  return Response.redirect(redirectTo, 302);
}
