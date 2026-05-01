import { createDb } from '@packrat/api/db';
import { users } from '@packrat/api/db/schema';
import { isValidApiKey, verifyJWT } from '@packrat/api/utils/auth';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
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

      const uid = Number(payload.userId);
      if (!Number.isFinite(uid) || uid <= 0) return status(401, { error: 'Unauthorized' });

      const db = createDb();

      // Reject soft-deleted accounts even when their JWT is still valid.
      const dbUser = await db.query.users.findFirst({
        columns: { id: true, deletedAt: true },
        where: eq(users.id, uid),
      });
      if (!dbUser || dbUser.deletedAt) return status(401, { error: 'Unauthorized' });

      // Fire-and-forget: update last_active_at at most once per 5 min per user
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      db.update(users)
        .set({ lastActiveAt: new Date() })
        .where(
          and(
            eq(users.id, uid),
            isNull(users.deletedAt),
            or(isNull(users.lastActiveAt), lt(users.lastActiveAt, fiveMinutesAgo)),
          ),
        )
        .catch(() => {});

      const { userId: _uid, role: _role, ...rest } = payload;
      return {
        user: {
          userId: uid,
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
