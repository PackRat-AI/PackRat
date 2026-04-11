import { isValidApiKey, verifyJWT } from '@packrat/api/utils/auth';
import { Elysia, status } from 'elysia';

/**
 * User payload injected into protected routes by the auth plugin.
 */
export type AuthUser = {
  userId: number;
  role: 'USER' | 'ADMIN';
  [key: string]: unknown;
};

/**
 * Elysia macro that enforces authentication on a route.
 *
 * Usage:
 * ```ts
 * import { authPlugin } from '@packrat/api/middleware/auth';
 *
 * new Elysia()
 *   .use(authPlugin)
 *   .get('/me', ({ user }) => user, { isAuthenticated: true });
 * ```
 *
 * The macro accepts either a Bearer JWT (verified via `verifyJWT`) or the
 * server-side `X-API-Key` header. On success, the validated user object is
 * injected into the route context as `user`.
 */
export const authPlugin = new Elysia({ name: 'packrat-auth' }).macro({
  isAuthenticated: {
    resolve: async ({ request }: { request: Request }) => {
      const authHeader = request.headers.get('authorization');

      if (authHeader) {
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        if (!token) {
          return status(401, { error: 'No token provided' });
        }
        const payload = await verifyJWT({ token });
        if (!payload) {
          return status(401, { error: 'Invalid token' });
        }
        return {
          user: {
            userId: Number(payload.userId),
            role: (payload.role as 'USER' | 'ADMIN') ?? 'USER',
            ...payload,
          } as AuthUser,
        };
      }

      if (isValidApiKey(request.headers)) {
        return {
          user: { userId: 0, role: 'ADMIN' } as AuthUser,
        };
      }

      return status(401, { error: 'Unauthorized' });
    },
  },
});

/**
 * Macro that additionally enforces ADMIN role.
 */
export const adminAuthPlugin = new Elysia({ name: 'packrat-admin-auth' })
  .use(authPlugin)
  .macro({
    isAdmin: {
      resolve: async ({ request }: { request: Request }) => {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) return status(401, { error: 'Unauthorized' });
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        if (!token) return status(401, { error: 'Unauthorized' });
        const payload = await verifyJWT({ token });
        if (!payload) return status(401, { error: 'Unauthorized' });
        if (payload.role !== 'ADMIN') {
          return status(403, { error: 'Forbidden' });
        }
        return {
          user: {
            userId: Number(payload.userId),
            role: 'ADMIN' as const,
            ...payload,
          } as AuthUser,
        };
      },
    },
  });

/**
 * Minimal macro accepting only the `X-API-Key` header for cron/admin routes.
 */
export const apiKeyAuthPlugin = new Elysia({ name: 'packrat-api-key-auth' }).macro({
  isValidApiKey: {
    resolve: ({ request }: { request: Request }) => {
      if (isValidApiKey(request.headers)) return true;
      return status(401, { error: 'Unauthorized' });
    },
  },
});
