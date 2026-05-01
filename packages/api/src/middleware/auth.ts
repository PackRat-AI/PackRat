import { isValidApiKey, verifyJWT } from '@packrat/api/utils/auth';
import { Elysia, status } from 'elysia';

export type AuthUser = {
  userId: number;
  role: 'USER' | 'ADMIN';
  [key: string]: unknown;
};

/**
 * Elysia macro that enforces Bearer-JWT authentication on a route. Routes
 * that need server-to-server API-key access must use `apiKeyAuthPlugin`
 * explicitly; this macro does not accept `X-API-Key` to avoid synthesizing
 * a user identity for a route that expects a real user.
 */
export const authPlugin = new Elysia({ name: 'packrat-auth' }).macro({
  isAuthenticated: {
    resolve: async ({ request }: { request: Request }) => {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) return status(401, { error: 'Unauthorized' });

      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      if (!token) return status(401, { error: 'No token provided' });

      const payload = await verifyJWT({ token });
      if (!payload) return status(401, { error: 'Invalid token' });

      const { userId: _uid, role: _role, ...rest } = payload;
      return {
        user: {
          userId: Number(payload.userId),
          role: (payload.role as 'USER' | 'ADMIN') ?? 'USER',
          ...rest,
        } as AuthUser, // safe-cast: JWT payload validated by auth middleware — userId and role fields are confirmed present
      };
    },
  },
});

/**
 * Macro that additionally enforces ADMIN role.
 */
export const adminAuthPlugin = new Elysia({ name: 'packrat-admin-auth' }).use(authPlugin).macro({
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
      const { userId: _uid, role: _role, ...rest } = payload;
      return {
        user: {
          userId: Number(payload.userId),
          role: 'ADMIN' as const,
          ...rest,
        } as AuthUser, // safe-cast: JWT payload validated by auth middleware — userId and ADMIN role confirmed present
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
      if (isValidApiKey(request.headers)) return { authorized: true };
      return status(401, { error: 'Unauthorized' });
    },
  },
});
