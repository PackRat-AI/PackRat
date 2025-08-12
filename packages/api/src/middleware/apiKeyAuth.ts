import type { MiddlewareHandler } from 'hono';
import { isValidApiKey } from '../utils/api-middleware';

export const apiKeyAuthMiddleware: MiddlewareHandler = async (c, next) => {
  if (isValidApiKey(c)) {
    return next();
  }

  return c.json({ error: 'Unauthorized' }, 401);
};
