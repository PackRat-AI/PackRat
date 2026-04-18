/**
 * OAuth 2.1 Authorization Server routes.
 *
 * Endpoints
 * ─────────
 *  GET  /oauth/authorize          — show consent / login form (PKCE flow)
 *  POST /oauth/authorize          — process login + issue authorization code
 *  POST /oauth/token              — exchange code or device_code for access token
 *  POST /oauth/device/code        — start Device Authorization Grant
 *  GET  /oauth/device/activate    — HTML page for users to enter user_code
 *  POST /oauth/device/activate    — process device activation (user login)
 *  POST /oauth/introspect         — token introspection (RFC 7662)
 *  POST /oauth/revoke             — token revocation (RFC 7009)
 *
 * The .well-known metadata endpoint is mounted at the API router level.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { users } from '@packrat/api/db/schema';
import {
  DEVICE_CODE_GRANT_TYPE,
  DeviceCodeRequestSchema,
  DeviceCodeResponseSchema,
  IntrospectRequestSchema,
  IntrospectResponseSchema,
  OAuthErrorSchema,
  RevokeRequestSchema,
  TokenRequestSchema,
  TokenResponseSchema,
} from '@packrat/api/schemas/oauth';
import {
  activateDeviceCode,
  consumeAuthorizationCode,
  createAccessToken,
  createAuthorizationCode,
  createDeviceCode,
  findClient,
  introspectToken,
  pollDeviceCode,
  revokeAccessToken,
} from '@packrat/api/services/oauthService';
import { verifyPassword } from '@packrat/api/utils/auth';
import type { Env } from '@packrat/api/types/env';
import { eq } from 'drizzle-orm';

export const oauthRoutes = new OpenAPIHono<{ Bindings: Env }>();

// ── HTML helpers ──────────────────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] ?? ch);
}

function consentPageHtml(params: {
  clientName: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  error?: string;
}): string {
  const e = (s: string) => escapeHtml(s);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PackRat — Authorize</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f3f4f6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border-radius:12px;padding:2rem;width:100%;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .logo{font-size:1.5rem;font-weight:700;color:#2563eb;margin-bottom:.25rem}
    .subtitle{color:#6b7280;font-size:.875rem;margin-bottom:1.5rem}
    .app{font-weight:600;color:#111827}
    .scope-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:.75rem;font-size:.8125rem;color:#374151;margin-bottom:1.5rem}
    label{display:block;font-size:.8125rem;font-weight:500;color:#374151;margin-bottom:.25rem}
    input[type=email],input[type=password]{display:block;width:100%;padding:.625rem .75rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9375rem;outline:none;transition:border-color .15s}
    input[type=email]:focus,input[type=password]:focus{border-color:#2563eb}
    .field{margin-bottom:1rem}
    button[type=submit]{width:100%;padding:.75rem;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:.9375rem;font-weight:600;cursor:pointer;margin-top:.5rem}
    button[type=submit]:hover{background:#1d4ed8}
    .error{color:#dc2626;font-size:.875rem;margin-bottom:1rem;background:#fef2f2;border:1px solid #fecaca;padding:.5rem .75rem;border-radius:8px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🎒 PackRat</div>
    <p class="subtitle">
      Sign in to authorize <span class="app">${e(params.clientName)}</span>
    </p>
    ${params.error ? `<div class="error">${e(params.error)}</div>` : ''}
    <div class="scope-box">
      <strong>Requested access:</strong> ${e(params.scope || '*')}
    </div>
    <form method="POST" action="/api/oauth/authorize">
      <input type="hidden" name="client_id" value="${e(params.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${e(params.redirectUri)}" />
      <input type="hidden" name="response_type" value="code" />
      <input type="hidden" name="scope" value="${e(params.scope)}" />
      <input type="hidden" name="state" value="${e(params.state)}" />
      <input type="hidden" name="code_challenge" value="${e(params.codeChallenge)}" />
      <input type="hidden" name="code_challenge_method" value="${e(params.codeChallengeMethod)}" />
      <div class="field">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="current-password" />
      </div>
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`;
}

function activatePageHtml(params: { userCode?: string; error?: string; success?: boolean }): string {
  const e = (s: string) => escapeHtml(s);
  if (params.success) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>PackRat — Authorized</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f3f4f6;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#fff;border-radius:12px;padding:2rem;max-width:380px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
.icon{font-size:3rem;margin-bottom:1rem}.title{font-size:1.25rem;font-weight:700;margin-bottom:.5rem}.subtitle{color:#6b7280;font-size:.9rem}</style>
</head>
<body><div class="card"><div class="icon">✅</div>
<div class="title">Device Authorized</div>
<p class="subtitle">You can close this window and return to your device.</p></div></body></html>`;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PackRat — Device Login</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f3f4f6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border-radius:12px;padding:2rem;width:100%;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .logo{font-size:1.5rem;font-weight:700;color:#2563eb;margin-bottom:.25rem}
    .subtitle{color:#6b7280;font-size:.875rem;margin-bottom:1.5rem}
    label{display:block;font-size:.8125rem;font-weight:500;color:#374151;margin-bottom:.25rem}
    input{display:block;width:100%;padding:.625rem .75rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9375rem;outline:none;transition:border-color .15s}
    input:focus{border-color:#2563eb}
    .field{margin-bottom:1rem}
    button[type=submit]{width:100%;padding:.75rem;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:.9375rem;font-weight:600;cursor:pointer;margin-top:.5rem}
    button[type=submit]:hover{background:#1d4ed8}
    .error{color:#dc2626;font-size:.875rem;margin-bottom:1rem;background:#fef2f2;border:1px solid #fecaca;padding:.5rem .75rem;border-radius:8px}
    .code-hint{font-family:monospace;font-size:1.1rem;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:.5rem .75rem;text-align:center;margin-bottom:1rem;letter-spacing:.1em}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🎒 PackRat</div>
    <p class="subtitle">Enter the code shown on your device, then sign in to authorize access.</p>
    ${params.error ? `<div class="error">${e(params.error)}</div>` : ''}
    <form method="POST" action="/api/oauth/device/activate">
      <div class="field">
        <label for="user_code">Device Code</label>
        ${params.userCode ? `<div class="code-hint">${e(params.userCode)}</div><input type="hidden" name="user_code" value="${e(params.userCode)}" />` : '<input id="user_code" name="user_code" placeholder="XXXX-XXXX" required autocomplete="off" autocapitalize="characters" />'}
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="current-password" />
      </div>
      <button type="submit">Authorize Device</button>
    </form>
  </div>
</body>
</html>`;
}

// ── GET /oauth/authorize ──────────────────────────────────────────────────────

const authorizeGetRoute = createRoute({
  method: 'get',
  path: '/authorize',
  tags: ['OAuth'],
  summary: 'Authorization endpoint (PKCE flow)',
  description: 'Renders the consent/login page for the Authorization Code + PKCE flow.',
  request: {
    query: z.object({
      client_id: z.string().min(1),
      redirect_uri: z.string().url(),
      response_type: z.literal('code'),
      scope: z.string().default('*'),
      state: z.string().optional(),
      code_challenge: z.string(),
      code_challenge_method: z.literal('S256'),
    }),
  },
  responses: {
    200: { description: 'HTML consent page' },
    400: {
      description: 'Invalid request',
      content: { 'application/json': { schema: OAuthErrorSchema } },
    },
  },
});

oauthRoutes.openapi(authorizeGetRoute, async (c) => {
  const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } =
    c.req.valid('query');

  const db = createDb(c);
  const client = await findClient(db, client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Unknown client' }, 400);
  }

  const html = consentPageHtml({
    clientName: client.name,
    clientId: client_id,
    redirectUri: redirect_uri,
    scope: scope ?? '*',
    state: state ?? '',
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method,
  });

  return c.html(html);
});

// ── POST /oauth/authorize ─────────────────────────────────────────────────────

oauthRoutes.post('/authorize', async (c) => {
  const body = await c.req.parseBody();

  const clientId = String(body.client_id ?? '');
  const redirectUri = String(body.redirect_uri ?? '');
  const scope = String(body.scope ?? '*');
  const state = String(body.state ?? '');
  const codeChallenge = String(body.code_challenge ?? '');
  const codeChallengeMethod = String(body.code_challenge_method ?? 'S256');
  const email = String(body.email ?? '');
  const password = String(body.password ?? '');

  const db = createDb(c);
  const client = await findClient(db, clientId);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Unknown client' }, 400);
  }

  const showError = (msg: string) =>
    c.html(
      consentPageHtml({
        clientName: client.name,
        clientId,
        redirectUri,
        scope,
        state,
        codeChallenge,
        codeChallengeMethod,
        error: msg,
      }),
      400,
    );

  if (!email || !password || !codeChallenge) {
    return showError('Email, password, and code_challenge are required.');
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  const passwordHash = user?.passwordHash ?? '';
  const valid = passwordHash ? await verifyPassword(password, passwordHash) : false;
  if (!user || !valid) {
    return showError('Invalid email or password.');
  }

  const code = await createAuthorizationCode(db, {
    clientId,
    userId: user.id,
    redirectUri,
    scope,
    codeChallenge,
    codeChallengeMethod,
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return c.redirect(redirectUrl.toString(), 302);
});

// ── POST /oauth/token ─────────────────────────────────────────────────────────

const tokenRoute = createRoute({
  method: 'post',
  path: '/token',
  tags: ['OAuth'],
  summary: 'Token endpoint',
  description:
    'Exchange an authorization code or device_code for an access token.',
  request: {
    body: {
      content: { 'application/json': { schema: TokenRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Access token issued',
      content: { 'application/json': { schema: TokenResponseSchema } },
    },
    400: {
      description: 'Token request failed',
      content: { 'application/json': { schema: OAuthErrorSchema } },
    },
  },
});

oauthRoutes.openapi(tokenRoute, async (c) => {
  const body = c.req.valid('json');
  const db = createDb(c);

  const client = await findClient(db, body.client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Unknown client' }, 400);
  }

  if (body.grant_type === 'authorization_code') {
    if (!body.code || !body.redirect_uri || !body.code_verifier) {
      return c.json(
        {
          error: 'invalid_request',
          error_description: 'code, redirect_uri, and code_verifier are required',
        },
        400,
      );
    }
    const consumed = await consumeAuthorizationCode(db, {
      code: body.code,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
    });
    if (!consumed) {
      return c.json(
        { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
        400,
      );
    }
    const { token, expiresIn } = await createAccessToken(db, {
      clientId: body.client_id,
      userId: consumed.userId,
      scope: consumed.scope,
    });
    return c.json({
      access_token: token,
      token_type: 'Bearer' as const,
      expires_in: expiresIn,
      scope: consumed.scope,
    });
  }

  if (body.grant_type === DEVICE_CODE_GRANT_TYPE) {
    if (!body.device_code) {
      return c.json(
        { error: 'invalid_request', error_description: 'device_code is required' },
        400,
      );
    }
    const result = await pollDeviceCode(db, {
      deviceCode: body.device_code,
      clientId: body.client_id,
    });

    if (result.status === 'expired') {
      return c.json({ error: 'expired_token', error_description: 'Device code expired' }, 400);
    }
    if (result.status === 'pending') {
      return c.json(
        { error: 'authorization_pending', error_description: 'Authorization pending' },
        400,
      );
    }

    const { token, expiresIn } = await createAccessToken(db, {
      clientId: result.clientId,
      userId: result.userId,
      scope: result.scope,
    });
    return c.json({
      access_token: token,
      token_type: 'Bearer' as const,
      expires_in: expiresIn,
      scope: result.scope,
    });
  }

  return c.json(
    {
      error: 'unsupported_grant_type',
      error_description: `Grant type '${body.grant_type}' is not supported`,
    },
    400,
  );
});

// ── POST /oauth/device/code ───────────────────────────────────────────────────

const deviceCodeRoute = createRoute({
  method: 'post',
  path: '/device/code',
  tags: ['OAuth'],
  summary: 'Device Authorization endpoint (RFC 8628)',
  description: 'Start the Device Authorization Grant flow. Returns device_code and user_code.',
  request: {
    body: {
      content: { 'application/json': { schema: DeviceCodeRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Device codes issued',
      content: { 'application/json': { schema: DeviceCodeResponseSchema } },
    },
    400: {
      description: 'Invalid request',
      content: { 'application/json': { schema: OAuthErrorSchema } },
    },
  },
});

oauthRoutes.openapi(deviceCodeRoute, async (c) => {
  const { client_id, scope } = c.req.valid('json');
  const db = createDb(c);

  const client = await findClient(db, client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Unknown client' }, 400);
  }
  if (!client.grants.includes(DEVICE_CODE_GRANT_TYPE)) {
    return c.json(
      {
        error: 'unauthorized_client',
        error_description: 'Client not authorized for device_code grant',
      },
      400,
    );
  }

  const origin = new URL(c.req.url).origin;
  const { deviceCode, userCode, expiresIn, interval } = await createDeviceCode(db, {
    clientId: client_id,
    scope: scope ?? '*',
  });

  const verificationUri = `${origin}/api/oauth/device/activate`;

  return c.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?user_code=${encodeURIComponent(userCode)}`,
    expires_in: expiresIn,
    interval,
  });
});

// ── GET /oauth/device/activate ────────────────────────────────────────────────

oauthRoutes.get('/device/activate', async (c) => {
  const userCode = c.req.query('user_code');
  return c.html(activatePageHtml({ userCode }));
});

// ── POST /oauth/device/activate ───────────────────────────────────────────────

oauthRoutes.post('/device/activate', async (c) => {
  const body = await c.req.parseBody();

  const userCode = String(body.user_code ?? '').toUpperCase();
  const email = String(body.email ?? '');
  const password = String(body.password ?? '');

  const showError = (msg: string) => c.html(activatePageHtml({ userCode, error: msg }), 400);

  if (!userCode || !email || !password) {
    return showError('Device code, email, and password are all required.');
  }

  const db = createDb(c);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  const passwordHash = user?.passwordHash ?? '';
  const valid = passwordHash ? await verifyPassword(password, passwordHash) : false;
  if (!user || !valid) {
    return showError('Invalid email or password.');
  }

  const activated = await activateDeviceCode(db, { userCode, userId: user.id });
  if (!activated) {
    return showError('Invalid or expired device code. Please start the login process again.');
  }

  return c.html(activatePageHtml({ success: true }));
});

// ── POST /oauth/introspect ────────────────────────────────────────────────────

const introspectRoute = createRoute({
  method: 'post',
  path: '/introspect',
  tags: ['OAuth'],
  summary: 'Token introspection (RFC 7662)',
  request: {
    body: {
      content: { 'application/json': { schema: IntrospectRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Token introspection result',
      content: { 'application/json': { schema: IntrospectResponseSchema } },
    },
  },
});

oauthRoutes.openapi(introspectRoute, async (c) => {
  const { token } = c.req.valid('json');
  const db = createDb(c);
  const result = await introspectToken(db, token);
  return c.json(result);
});

// ── POST /oauth/revoke ────────────────────────────────────────────────────────

const revokeRoute = createRoute({
  method: 'post',
  path: '/revoke',
  tags: ['OAuth'],
  summary: 'Token revocation (RFC 7009)',
  request: {
    body: {
      content: { 'application/json': { schema: RevokeRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: { description: 'Token revoked (always 200 per RFC 7009)' },
  },
});

oauthRoutes.openapi(revokeRoute, async (c) => {
  const { token } = c.req.valid('json');
  const db = createDb(c);
  await revokeAccessToken(db, token);
  // RFC 7009: always respond 200 regardless of whether token existed
  return c.json({ revoked: true });
});

// ── AS Metadata (RFC 8414) — exported for mounting at /.well-known ─────────────

export async function oauthMetadataHandler(c: { req: { url: string } }): Promise<Response> {
  const origin = new URL(c.req.url).origin;
  const issuer = `${origin}/api`;
  return Response.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    device_authorization_endpoint: `${issuer}/oauth/device/code`,
    introspection_endpoint: `${issuer}/oauth/introspect`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', DEVICE_CODE_GRANT_TYPE],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
}
