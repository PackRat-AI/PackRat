import type { Env } from '@packrat/api/types/env';
import { isValidApiKey } from '@packrat/api/utils/api-middleware';
import type { MiddlewareHandler } from 'hono';
import { env } from 'hono/adapter';
import { verify } from 'hono/jwt';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  // JWT Auth
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (!token) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const { JWT_SECRET } = env<Env>(c);

    try {
      const payload = await verify(token, JWT_SECRET);
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
