import type { MiddlewareHandler } from 'hono';
import { isValidApiKey } from '../utils/auth';

// biome-ignore lint/complexity/useMaxParams: existing code - migrate to single typed object parameter
export const apiKeyAuthMiddleware: MiddlewareHandler = async (c, next) => {
  if (isValidApiKey(c)) {
    return next();
  }

  return c.json({ error: 'Unauthorized' }, 401);
};
