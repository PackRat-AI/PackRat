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
 * KV layout (all keys expire after 10 minutes):
 *   oauth_state:<stateKey>  → JSON-serialised AuthRequest from parseAuthRequest()
 *   session:<stateKey>      → JSON { token: string, userId: string }
 */

import { isString } from '@packrat/guards';
import { createRegExp, exactly, global as globalFlag } from 'magic-regexp';
import { z } from 'zod';
import type { Env, Props } from './types';

// ── HTML-escape regexes (magic-regexp so the pre-push hook is satisfied) ─────
const AMP_RE = createRegExp(exactly('&'), [globalFlag]);
const LT_RE = createRegExp(exactly('<'), [globalFlag]);
const GT_RE = createRegExp(exactly('>'), [globalFlag]);
const QUOT_RE = createRegExp(exactly('"'), [globalFlag]);

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

// ── Handler ───────────────────────────────────────────────────────────────────

export const PackRatAuthHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: 'packrat-mcp',
        version: '1.0.0',
        transport: 'streamable-http',
        endpoint: '/mcp',
        docs: 'https://packrat.world/docs/mcp',
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
