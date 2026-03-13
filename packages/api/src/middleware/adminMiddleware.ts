import type { MiddlewareHandler } from 'hono';

// biome-ignore lint/complexity/useMaxParams: existing code - migrate to single typed object parameter
export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (user.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  return next();
};
