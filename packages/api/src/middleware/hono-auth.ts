/**
 * Legacy Hono auth middleware – kept during the staged Elysia migration so
 * routes that have not yet been ported from Hono continue to function inside
 * the outer Elysia app (which mounts the Hono sub-app via `.mount()`).
 *
 * New Elysia routes should use the macros exported from `./auth.ts`.
 */
import { isValidApiKey, verifyJWT } from '@packrat/api/utils/auth';
import type { MiddlewareHandler } from 'hono';

export const honoAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (!token) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const payload = await verifyJWT({ token, c });
    if (!payload) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    c.set('user', {
      userId: Number(payload.userId),
      role: (payload.role as 'USER' | 'ADMIN') ?? 'USER',
      ...payload,
    });
    return next();
  }

  if (isValidApiKey(c)) {
    return next();
  }

  return c.json({ error: 'Unauthorized' }, 401);
};

export const honoApiKeyAuthMiddleware: MiddlewareHandler = async (c, next) => {
  if (isValidApiKey(c)) return next();
  return c.json({ error: 'Unauthorized' }, 401);
};

export const honoAdminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user') as { role?: string } | undefined;
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'ADMIN') return c.json({ error: 'Forbidden' }, 403);
  return next();
};
