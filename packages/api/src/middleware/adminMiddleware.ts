import type { MiddlewareHandler } from 'hono';

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  return next();
};
