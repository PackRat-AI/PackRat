/**
 * Web OAuth 2.0 + PKCE routes for browser/server clients.
 *
 * Flow:
 *   1. GET /authorize?provider=google[&finalRedirect=...]
 *      → Generates code_verifier + state, stores in DB, redirects to Google
 *   2. GET /callback?code=...&state=...
 *      → Exchanges code (+ code_verifier) for tokens, creates/finds user,
 *        redirects to finalRedirect with access+refresh tokens (or returns JSON)
 *
 * Supports: Google (more providers can be added by extending PROVIDER_CONFIG)
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { authProviders, oauthStates, refreshTokens, users } from '@packrat/api/db/schema';
import {
  OAuthAuthorizeRequestSchema,
  OAuthAuthorizeResponseSchema,
  OAuthTokenResponseSchema,
  ErrorResponseSchema,
} from '@packrat/api/schemas/auth';
import type { Env } from '@packrat/api/types/env';
import { generateJWT, generateRefreshToken } from '@packrat/api/utils/auth';
import { decodeBase64urlJson } from '@packrat/api/utils/appleAuth';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateCodeChallenge, generateCodeVerifier, generateOAuthState } from '@packrat/api/utils/pkce';
import { assertDefined } from '@packrat/guards';
import { and, eq, getTableColumns, gt } from 'drizzle-orm';

const { passwordHash: _, ...userWithoutPassword } = getTableColumns(users);

const OAUTH_STATE_TTL_MINUTES = 10;

// ─── Provider config ──────────────────────────────────────────────────────────

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email', 'profile'],
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

export const oauthRoutes = new OpenAPIHono<{ Bindings: Env }>();

// GET /authorize
const authorizeRoute = createRoute({
  method: 'get',
  path: '/authorize',
  tags: ['Authentication'],
  summary: 'Start web OAuth PKCE flow',
  description:
    'Generates a PKCE code verifier and state, stores them in the database, ' +
    'then redirects the client to the OAuth provider authorization page.',
  request: {
    query: OAuthAuthorizeRequestSchema,
  },
  responses: {
    302: {
      description: 'Redirect to OAuth provider',
    },
    200: {
      description: 'Authorization URL (when Accept: application/json)',
      content: {
        'application/json': {
          schema: OAuthAuthorizeResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid provider or missing Google client secret',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

oauthRoutes.openapi(authorizeRoute, async (c) => {
  const { provider, finalRedirect } = c.req.valid('query');

  const config = PROVIDERS[provider];
  if (!config) {
    return c.json({ error: `Unsupported provider: ${provider}` }, 400);
  }

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getEnv(c);
  if (!GOOGLE_CLIENT_SECRET) {
    return c.json({ error: 'Google OAuth is not configured on this server' }, 400);
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateOAuthState();

  const db = createDb(c);
  await db.insert(oauthStates).values({
    state,
    codeVerifier,
    provider,
    finalRedirect: finalRedirect ?? null,
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000),
  });

  const callbackUrl = new URL('/api/auth/oauth/callback', new URL(c.req.url).origin).toString();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl,
    scope: config.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  const authorizationUrl = `${config.authUrl}?${params.toString()}`;

  // Support API clients that prefer JSON over a redirect
  const acceptHeader = c.req.header('Accept') ?? '';
  if (acceptHeader.includes('application/json')) {
    return c.json({ authorizationUrl, state }, 200);
  }

  return c.redirect(authorizationUrl, 302);
});

// ─── Callback ─────────────────────────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface GoogleIdTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

function decodeJwtPayload<T>(token: string): T {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT');
  }
  return decodeBase64urlJson<T>(parts[1] ?? '');
}

const callbackRoute = createRoute({
  method: 'get',
  path: '/callback',
  tags: ['Authentication'],
  summary: 'OAuth PKCE callback',
  description:
    'Handles the OAuth provider callback: validates state, exchanges the authorization ' +
    'code for tokens using the stored PKCE code verifier, then issues a PackRat session.',
  request: {
    query: z.object({
      code: z.string().optional().openapi({ description: 'Authorization code from provider' }),
      state: z.string().optional().openapi({ description: 'CSRF state token' }),
      error: z.string().optional().openapi({ description: 'Error from provider' }),
      error_description: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Authentication successful',
      content: { 'application/json': { schema: OAuthTokenResponseSchema } },
    },
    302: {
      description: 'Redirect to finalRedirect with tokens',
    },
    400: {
      description: 'Invalid state, missing code, or provider error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Token exchange or user creation failed',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

oauthRoutes.openapi(callbackRoute, async (c) => {
  const { code, state, error, error_description } = c.req.valid('query');

  if (error) {
    return c.json(
      { error: error_description ?? error ?? 'OAuth provider returned an error' },
      400,
    );
  }

  if (!state || !code) {
    return c.json({ error: 'Missing state or code parameter' }, 400);
  }

  const db = createDb(c);

  // Validate and consume the PKCE state record
  const [storedState] = await db
    .select()
    .from(oauthStates)
    .where(and(eq(oauthStates.state, state), gt(oauthStates.expiresAt, new Date())))
    .limit(1);

  if (!storedState) {
    return c.json({ error: 'Invalid or expired OAuth state' }, 400);
  }

  // Delete state immediately (one-time use)
  await db.delete(oauthStates).where(eq(oauthStates.id, storedState.id));

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getEnv(c);
  if (!GOOGLE_CLIENT_SECRET) {
    return c.json({ error: 'Google OAuth is not configured on this server' }, 400);
  }

  const config = PROVIDERS[storedState.provider];
  if (!config) {
    return c.json({ error: `Unsupported provider: ${storedState.provider}` }, 400);
  }

  const callbackUrl = new URL('/api/auth/oauth/callback', new URL(c.req.url).origin).toString();

  // Exchange authorization code for tokens
  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code_verifier: storedState.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error('Google token exchange failed:', tokenRes.status, body);
    return c.json({ error: 'Failed to exchange authorization code' }, 500);
  }

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenData.id_token) {
    return c.json({ error: 'No id_token in Google response' }, 500);
  }

  // Decode the id_token (Google's token endpoint returns a standard JWT; for
  // a web PKCE flow the token was already bound to our client_id during the
  // server-to-server code exchange with client_secret, so there is no vector
  // for a third party to replay a forged token. Signature verification against
  // Google's JWKS would add defence-in-depth but is omitted here for simplicity.)
  let googlePayload: GoogleIdTokenPayload;
  try {
    googlePayload = decodeJwtPayload<GoogleIdTokenPayload>(tokenData.id_token);
  } catch {
    return c.json({ error: 'Invalid id_token from Google' }, 500);
  }

  if (!googlePayload.email || !googlePayload.sub) {
    return c.json({ error: 'Missing required fields in Google id_token' }, 500);
  }

  // Resolve or create user + provider link
  const [existingProvider] = await db
    .select()
    .from(authProviders)
    .where(
      and(eq(authProviders.provider, 'google'), eq(authProviders.providerId, googlePayload.sub)),
    )
    .limit(1);

  let userId: number;
  let isNewUser = false;

  if (existingProvider) {
    userId = existingProvider.userId;
  } else {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, googlePayload.email))
      .limit(1);

    if (existingUser) {
      userId = existingUser.id;
      await db
        .insert(authProviders)
        .values({ userId, provider: 'google', providerId: googlePayload.sub })
        .onConflictDoNothing();
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          email: googlePayload.email,
          firstName: googlePayload.given_name ?? null,
          lastName: googlePayload.family_name ?? null,
          emailVerified: googlePayload.email_verified ?? false,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: { updatedAt: new Date() },
        })
        .returning();
      assertDefined(newUser);
      userId = newUser.id;
      isNewUser = true;

      await db
        .insert(authProviders)
        .values({ userId, provider: 'google', providerId: googlePayload.sub })
        .onConflictDoNothing();
    }
  }

  const [user] = await db
    .select(userWithoutPassword)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  assertDefined(user);

  const refreshToken = generateRefreshToken();
  await db.insert(refreshTokens).values({
    userId,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const accessToken = await generateJWT({ payload: { userId, role: user.role }, c });

  const tokenPayload = { success: true, accessToken, refreshToken, user, isNewUser };

  if (storedState.finalRedirect) {
    const redirectUrl = new URL(storedState.finalRedirect);
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);
    return c.redirect(redirectUrl.toString(), 302);
  }

  return c.json(tokenPayload, 200);
});
