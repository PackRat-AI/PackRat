/**
 * PackRat MCP OAuth 2.1 authorization handler.
 *
 * Implements the user-facing parts of the OAuth flow:
 *   GET  /authorize → parse OAuth request, redirect to /login
 *   GET  /login     → serve sign-in form (CSRF nonce minted + persisted in KV)
 *   POST /login     → CSRF-validated, Origin-validated, rate-limited; calls
 *                      Better Auth and redirects to /callback
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
 * U6 hardening for the login form:
 *   - CSRF: a UUID nonce is set in a `__Host-PR_CSRF` cookie at /authorize,
 *     persisted in KV under `csrf:<stateKey>`, and embedded in the login
 *     form as a hidden `csrf` field. POST /login must present a cookie
 *     value that matches the form field AND matches the KV entry. The
 *     KV-bound check is the load-bearing defense — a pure double-submit
 *     cookie can be forged by a subdomain XSS, so we anchor on the
 *     server-side KV record.
 *   - Origin: POST /login rejects requests whose `Origin` header is
 *     present and does not match the production custom domain (or the
 *     request URL's own origin in dev). A missing Origin header is
 *     allowed for back-compat — some MCP-flow user agents don't send one.
 *   - Rate limit: `handleLoginPost` calls `checkLoginRateLimit(env, ip)`,
 *     today always allowing. U14 swaps the implementation in to call
 *     `env.MCP_TOOLS_RL.limit(...)`.
 *   - Better Auth response mapping: HTTP 429 / 423 / 401 / 5xx get
 *     distinct user-facing copies via `betterAuthErrorCopy()`.
 *
 * KV layout (all keys expire after 10 minutes):
 *   oauth_state:<stateKey>  → JSON-serialised AuthRequest from parseAuthRequest()
 *   csrf:<stateKey>         → CSRF nonce; checked against cookie + form field
 *   session:<stateKey>      → JSON { token: string, userId: string }
 */

import { isString } from '@packrat/guards';
import { caseInsensitive, createRegExp, exactly, oneOrMore, whitespace } from 'magic-regexp';
import { z } from 'zod';
import { ServiceMeta } from './constants';
import { renderLoginPage } from './login-page';
import { unauthorizedResponse } from './metadata';
import { SCOPES_SUPPORTED } from './scopes';
import type { Env, Props } from './types';

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
function csrfKey(key: string) {
  return `csrf:${key}`;
}

// ── CSRF / Origin / cookie helpers ────────────────────────────────────────────

/**
 * Cookie name for the CSRF double-submit nonce.
 *
 * The `__Host-` prefix forces:
 *   - `Secure` (HTTPS-only)
 *   - `Path=/`
 *   - no `Domain` attribute (host-locked)
 *
 * which together make this cookie attached only to this exact host. The KV-
 * bound check (`csrf:<stateKey>` lookup) in `handleLoginPost` is what makes
 * this defense actually load-bearing — a subdomain XSS could still write a
 * cookie that *parses* the same, but it couldn't fabricate a matching KV
 * entry. See doc-review finding F5.
 */
const CSRF_COOKIE_NAME = '__Host-PR_CSRF';

/** Production custom-domain origin. Matched against `Origin` header in /login POST. */
const PROD_ORIGIN = 'https://mcp.packratai.com';

/**
 * Parse a `Cookie` header value into a `{ name: value }` map.
 *
 * Tiny, allocation-light parser — we don't have an HTTP cookie library in
 * the worker bundle and pulling one in for a single header would be
 * wasteful. Whitespace around the `=` is tolerated; values are NOT URI-
 * decoded (our nonces are URL-safe UUIDs).
 */
function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

/**
 * Build a `Set-Cookie` header value for the CSRF nonce.
 *
 * `__Host-` cookies must omit `Domain`, set `Path=/`, and set `Secure`.
 * `HttpOnly` keeps JS in the page from leaking the value; `SameSite=Lax`
 * still lets it travel on the top-level POST to /login (which originates
 * from the same site).
 */
function buildCsrfSetCookie(nonce: string): string {
  return `${CSRF_COOKIE_NAME}=${nonce}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${STATE_TTL}`;
}

/**
 * Constant-time comparison of two CSRF tokens. Mirrors `timingSafeEqual`
 * below but expressed separately so the call site reads as "are these
 * two nonces the same" rather than "is this bearer the secret".
 */
function csrfEqual(a: string, b: string): boolean {
  return timingSafeEqual(a, b);
}

/**
 * Validate the `Origin` header on a /login POST.
 *
 * Returns:
 *   - `true` if the header is missing (back-compat: some MCP-flow user
 *     agents don't send it; documented in `docs/mcp/runbook.md`).
 *   - `true` if the header matches the production custom domain.
 *   - `true` if the header matches the request URL's own origin
 *     (covers dev workers.dev hostnames and local development).
 *   - `false` otherwise (caller returns 403).
 *
 * We never accept an arbitrary `Origin` value; the dev fallback is bounded
 * to the request URL's own origin so a request from elsewhere can't fake
 * its way through by simply asserting the worker's hostname.
 */
function isOriginAcceptable(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin === null) return true;
  if (origin === PROD_ORIGIN) return true;
  const reqOrigin = new URL(request.url).origin;
  return origin === reqOrigin;
}

// ── Login rate-limit stub (U14 swap point) ────────────────────────────────────

/**
 * Per-IP login rate-limit check.
 *
 * TODO (U14): swap this stub for a call to the Workers Rate Limiting
 * binding, e.g.:
 *
 *   const { success } = await env.MCP_TOOLS_RL.limit({ key: `login:${ip}` });
 *   return success;
 *
 * Today it always returns `true` (allowed) so the call site can be wired
 * up now — that way U14 only swaps the body of this function, not the
 * `handleLoginPost` flow. Keep the signature stable: a `Promise<boolean>`
 * where `false` means "rate-limited, reject".
 *
 * The `ip` argument is the best-effort caller IP, derived in the handler
 * via `cf-connecting-ip` with `x-forwarded-for` as a fallback. An empty
 * string is permitted and means "couldn't determine IP" — U14 should
 * still treat that as a request to limit (e.g. use the cf-ray as a
 * fallback key) rather than a free pass.
 */
export async function checkLoginRateLimit(_env: Env, _ip: string): Promise<boolean> {
  return true;
}

// ── Better Auth response → user copy mapping ──────────────────────────────────

/**
 * Map a Better Auth `/sign-in/email` HTTP status to the message we show
 * on the login page.
 *
 * Pulled into a small helper so test cases can target each status path
 * individually and so the copy stays consistent across the handler:
 *
 *   429 → "Too many sign-in attempts."   (Better Auth's rate-limit plugin)
 *   423 → "This account is locked."       (admin-plugin lockout response)
 *   401 → "Invalid email or password."    (default failure path)
 *   other 4xx → "Invalid email or password." (avoid leaking unrelated 4xx)
 *   5xx → "PackRat sign-in is temporarily unavailable. Try again shortly."
 *
 * 2xx is the success path and not handled here.
 */
export interface LoginErrorCopy {
  /** HTTP status to return on the rendered login page. */
  status: number;
  /** User-facing message rendered into the page's error banner. */
  message: string;
}

export function betterAuthErrorCopy(status: number): LoginErrorCopy {
  if (status === 429) {
    return {
      status: 429,
      message: 'Too many sign-in attempts. Please wait a minute and try again.',
    };
  }
  if (status === 423) {
    return {
      status: 423,
      message: 'This account is locked. Check your email for a reset link or contact support.',
    };
  }
  if (status >= 500) {
    return {
      status: 502,
      message: 'PackRat sign-in is temporarily unavailable. Try again shortly.',
    };
  }
  // 401, 400, 403, etc. — collapse into the canonical credentials error
  // so we don't leak "user exists but wrong password" vs. "no such user".
  return { status: 401, message: 'Invalid email or password.' };
}

/**
 * FormData.get() returns FormDataEntryValue | null (string | File | null).
 * Extract string only. (The branded HTML lives in `./login-page.ts`; the
 * helpers below are the parts of the old `loginPage` module that aren't
 * presentation — keep them here so the OAuth handler is self-contained.)
 */
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
      return request.method === 'POST'
        ? handleLoginPost(request, env)
        : handleLoginGet(request, env);
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
  const csrfNonce = crypto.randomUUID();

  // Persist OAuth state and CSRF nonce in parallel; both expire after 10 min.
  await Promise.all([
    env.OAUTH_KV.put(oauthStateKey(stateKey), JSON.stringify(oauthReq), {
      expirationTtl: STATE_TTL,
    }),
    env.OAUTH_KV.put(csrfKey(stateKey), csrfNonce, {
      expirationTtl: STATE_TTL,
    }),
  ]);

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('state', stateKey);

  // Manual response (rather than `Response.redirect`) so we can attach
  // Set-Cookie. The KV-bound CSRF check in /login POST is the load-bearing
  // defense — the cookie is the double-submit witness, not the truth.
  return new Response(null, {
    status: 302,
    headers: {
      Location: loginUrl.toString(),
      'Set-Cookie': buildCsrfSetCookie(csrfNonce),
    },
  });
}

// ── /login GET ────────────────────────────────────────────────────────────────

async function handleLoginGet(request: Request, env: Env): Promise<Response> {
  const state = new URL(request.url).searchParams.get('state') ?? '';

  // The CSRF nonce lives in KV (set by /authorize); the cookie is the
  // double-submit witness. If the user lost the cookie (e.g. opened the
  // /login URL directly without going through /authorize), the KV entry
  // might still exist — read it back so the rendered form's hidden field
  // matches whatever cookie the browser already holds. The POST handler
  // is what actually enforces the three-way match.
  const csrfNonce = state ? ((await env.OAUTH_KV.get(csrfKey(state))) ?? '') : '';

  return new Response(renderLoginPage({ state, csrf: csrfNonce }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ── /login POST ───────────────────────────────────────────────────────────────

async function handleLoginPost(request: Request, env: Env): Promise<Response> {
  // ── Origin check (back-compat: missing Origin is allowed) ────────────────
  // Reject before parsing the body to avoid wasted work on cross-origin
  // posts. Bare-bones response — the browser won't even render this.
  if (!isOriginAcceptable(request)) {
    return new Response('Forbidden: bad Origin', { status: 403 });
  }

  // ── Parse form ───────────────────────────────────────────────────────────
  let email: string;
  let password: string;
  let state: string;
  let csrfField: string;

  try {
    const form = await request.formData();
    email = getFormString(form, 'email');
    password = getFormString(form, 'password');
    state = getFormString(form, 'state');
    csrfField = getFormString(form, 'csrf');
  } catch {
    return new Response(
      renderLoginPage({ state: '', csrf: '', error: 'Invalid form submission.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  // ── CSRF: cookie present, KV-bound, three-way match ──────────────────────
  // The triple-check is intentional: a pure double-submit cookie (cookie==field)
  // is forgeable by a subdomain XSS that can write `__Host-PR_CSRF`. The
  // KV anchor (`csrf:<state>`) is what makes this load-bearing — an
  // attacker would also have to control the worker's KV to fabricate it.
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookieHeader(cookieHeader);
  const csrfCookie = cookies[CSRF_COOKIE_NAME] ?? '';

  if (!csrfCookie || !csrfField) {
    return new Response(
      renderLoginPage({
        state,
        csrf: csrfField,
        error: 'CSRF check failed. Please reload and try again.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  if (!state) {
    return new Response(
      renderLoginPage({
        state,
        csrf: csrfField,
        error: 'Missing sign-in state. Please reload and try again.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  const csrfFromKv = await env.OAUTH_KV.get(csrfKey(state));
  if (!csrfFromKv) {
    // KV entry missing means /authorize was never visited or the nonce
    // expired. Either way the post can't be trusted.
    return new Response(
      renderLoginPage({
        state,
        csrf: csrfField,
        error: 'CSRF check failed. Please reload and try again.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  if (!csrfEqual(csrfCookie, csrfField) || !csrfEqual(csrfFromKv, csrfField)) {
    return new Response(
      renderLoginPage({
        state,
        csrf: csrfField,
        error: 'CSRF check failed. Please reload and try again.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  // ── Rate limit (U14 will swap the stub for env.MCP_TOOLS_RL.limit) ───────
  // Caller IP is best-effort: Cloudflare populates `cf-connecting-ip`;
  // `x-forwarded-for` is the standard fallback. An empty value is fine —
  // the U14 implementation can decide how to handle it.
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '';
  const allowed = await checkLoginRateLimit(env, ip);
  if (!allowed) {
    return new Response(
      renderLoginPage({
        state,
        csrf: csrfField,
        error: 'Too many sign-in attempts. Please wait a minute and try again.',
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  // ── Field validation ─────────────────────────────────────────────────────
  if (!email || !password) {
    return new Response(
      renderLoginPage({ state, csrf: csrfField, error: 'Email and password are required.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  const oauthReqStr = await env.OAUTH_KV.get(oauthStateKey(state));
  if (!oauthReqStr) {
    return new Response(
      renderLoginPage({ state, csrf: csrfField, error: 'Session expired. Please start over.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  // ── Better Auth call ─────────────────────────────────────────────────────
  let signInRes: Response;
  try {
    signInRes = await fetch(`${env.PACKRAT_API_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    // Network-level failure (DNS, timeout, etc.) — treat as a transient
    // upstream outage with the same copy as a 5xx response body.
    const copy = betterAuthErrorCopy(503);
    return new Response(renderLoginPage({ state, csrf: csrfField, error: copy.message }), {
      status: copy.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!signInRes.ok) {
    // Map distinct Better Auth statuses to distinct user-facing copy.
    // The mapping lives in `betterAuthErrorCopy` so the unit tests can
    // target each branch (429 / 423 / 401 / 5xx) without spinning up
    // the full handler.
    const copy = betterAuthErrorCopy(signInRes.status);
    return new Response(renderLoginPage({ state, csrf: csrfField, error: copy.message }), {
      status: copy.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const signInResult = SignInResponseSchema.safeParse(await signInRes.json().catch(() => null));
  const betterAuthToken = signInResult.success ? signInResult.data.session?.token : undefined;
  const userId = signInResult.success ? signInResult.data.user?.id : undefined;

  if (!betterAuthToken || !userId) {
    return new Response(
      renderLoginPage({
        state,
        csrf: csrfField,
        error: 'Sign-in succeeded but session data was missing.',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  await env.OAUTH_KV.put(sessionKey(state), JSON.stringify({ token: betterAuthToken, userId }), {
    expirationTtl: STATE_TTL,
  });

  // CSRF nonce no longer needed once we're heading to /callback — best-effort delete.
  void env.OAUTH_KV.delete(csrfKey(state));

  const callbackUrl = new URL('/callback', request.url);
  callbackUrl.searchParams.set('state', state);
  return Response.redirect(callbackUrl.toString(), 302);
}

// ── /callback ─────────────────────────────────────────────────────────────────

/**
 * Timeout for the Better Auth role lookup at `/callback`. If Better Auth is
 * degraded, the OAuth grant must still proceed (so users aren't locked out
 * of basic functionality) but WITHOUT `mcp:admin` — admin tools stay
 * hidden until a follow-up authorization happens against a healthy
 * backend. 5s aligns with the API-side guard timeout (see
 * `packages/api/src/routes/admin/index.ts` U5 extension).
 */
const BETTER_AUTH_ROLE_LOOKUP_TIMEOUT_MS = 5000;

const SessionResponseSchema = z.object({
  user: z
    .object({
      role: z.string().optional(),
    })
    .optional(),
});

/**
 * Ask Better Auth (via the PackRat API) whether the bearer's session
 * resolves to an admin user. Returns `true` only on an unambiguous
 * `user.role === 'ADMIN'` response within the timeout window; everything
 * else (timeout, network error, non-200, malformed body, role !== ADMIN)
 * returns `false`. Fail-closed: a degraded Better Auth never escalates
 * scope.
 *
 * U15 will replace the `console.warn` with a structured-log helper.
 */
async function isAdminUser(env: Env, betterAuthToken: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BETTER_AUTH_ROLE_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.PACKRAT_API_URL}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${betterAuthToken}` },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const parsed = SessionResponseSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) return false;
    return parsed.data.user?.role === 'ADMIN';
  } catch (e) {
    // TODO (U15): structured log — distinguish timeout (AbortError) from
    // transport errors. Both are fail-closed today, but the operational
    // signal differs.
    console.warn('[mcp/auth] Better Auth role lookup failed; granting non-admin scope', e);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Compute the scope set to grant the new OAuth token.
 *
 * Per RFC 6749 §3.3 the granted scope must be a subset of what was
 * requested; the OAuthProvider validates this for us. We additionally
 * intersect the requested scopes with `SCOPES_SUPPORTED` so unknown
 * scope strings are silently dropped (defensive — the AS advertises the
 * supported list, so a well-behaved client should not ask for others).
 *
 * `mcp:admin` is granted ONLY when the user resolves to ADMIN at this
 * specific authorization moment. A non-admin user asking for `mcp:admin`
 * does NOT get it; they get the rest of their request stripped of
 * `mcp:admin`. A degraded Better Auth makes everyone non-admin —
 * see `isAdminUser` for fail-closed semantics.
 */
function grantedScopesFor(requestedScopes: readonly string[], isAdmin: boolean): string[] {
  const supported = new Set<string>(SCOPES_SUPPORTED);
  const granted = new Set<string>();
  for (const scope of requestedScopes) {
    if (!supported.has(scope)) continue;
    if (scope === 'mcp:admin' && !isAdmin) continue;
    granted.add(scope);
  }
  // Defensive: if the requested set was empty (or got fully filtered), we
  // still grant the legacy umbrella `mcp` scope so the session is usable
  // for reads. Pre-split clients relied on this implicit behaviour.
  if (granted.size === 0) {
    granted.add('mcp');
  }
  return [...granted];
}

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

  // Clean up KV state (best-effort). The csrf key is normally cleared by
  // /login POST, but we delete it again here defensively in case /callback
  // is reached via an alternate path (e.g. a future SSO callback flow).
  void Promise.all([
    env.OAUTH_KV.delete(oauthStateKey(state)),
    env.OAUTH_KV.delete(sessionKey(state)),
    env.OAUTH_KV.delete(csrfKey(state)),
  ]);

  // ── U5 scope grant ────────────────────────────────────────────────────────
  // Look up the user's role only if they actually asked for `mcp:admin` —
  // skipping the round trip for non-admin requests keeps `/callback`
  // fast for the common case. Per RFC 6749, granted scope must be a
  // subset of requested, so a client that didn't request `mcp:admin`
  // can't receive it even if the user IS an admin.
  const wantedAdmin = oauthReq.scope.includes('mcp:admin');
  const isAdmin = wantedAdmin ? await isAdminUser(env, betterAuthToken) : false;
  const grantedScopes = grantedScopesFor(oauthReq.scope, isAdmin);

  // Tell the OAuthProvider exactly which scopes we're granting (so the
  // library's down-scoping check passes) and embed the same list in
  // `props.scopes` so the DO can apply scope-based tool visibility.
  // Note that `props.scopes` and `completeAuthorization({ scope })` must
  // match — drift here would mean the access token is issued for one
  // scope set but tools/list is filtered against another.
  const props: Props = {
    betterAuthToken,
    userId,
    scopes: grantedScopes,
  };

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReq,
    userId,
    metadata: {},
    scope: grantedScopes,
    props,
  });

  return Response.redirect(redirectTo, 302);
}
