import { createDb } from '@packrat/api/db';
import { validateAccessToken } from '@packrat/api/services/oauthService';
import { isValidApiKey } from '@packrat/api/utils/auth';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { MiddlewareHandler } from 'hono';
import { verify } from 'hono/jwt';

/** Prefix used by opaque OAuth access tokens issued by the OAuth 2.1 AS. */
const OAUTH_TOKEN_PREFIX = 'oa_';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (!token) {
      return c.json({ error: 'No token provided' }, 401);
    }

    // OAuth 2.1 opaque access token
    if (token.startsWith(OAUTH_TOKEN_PREFIX)) {
      const db = createDb(c);
      const result = await validateAccessToken(db, token);
      if (!result) {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }
      const role = result.role === 'ADMIN' ? ('ADMIN' as const) : ('USER' as const);
      c.set('user', { userId: result.userId, role, scope: result.scope });
      return next();
    }

    // JWT (issued by /api/auth/login)
    const { JWT_SECRET } = getEnv(c);
    try {
      const payload = await verify(token, JWT_SECRET, { alg: 'HS256' });
      c.set('user', payload);
      return next();
    } catch (_error) {
      return c.json({ error: 'Invalid token' }, 401);
    }
  }

  // API Key Auth
  if (isValidApiKey(c)) {
    return next();
  }

  return c.json({ error: 'Unauthorized' }, 401);
};
