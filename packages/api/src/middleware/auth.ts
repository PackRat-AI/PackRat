import { getAuth } from '@packrat/api/auth';
import { getLocalE2EUserFromRequest } from '@packrat/api/auth/local-e2e';
import { isValidApiKey } from '@packrat/api/utils/auth';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import { apiAddBreadcrumb, captureApiException, setApiUser } from '@packrat/api/utils/sentry';
import { Elysia, status } from 'elysia';

export type AuthUser = {
  userId: string;
  role: string;
  email: string;
  name: string;
};

/**
 * Elysia macro that enforces Better Auth session authentication.
 *
 * Accepts both cookie-based sessions and Bearer token sessions (via the
 * bearer() plugin).  Sets `user` in the request context for downstream routes.
 */
export const authPlugin = new Elysia({ name: 'packrat-auth' }).macro({
  isAuthenticated: {
    resolve: async ({ request }: { request: Request }) => {
      const env = getEnv() as ValidatedEnv; // safe-cast: Worker env validated at startup; TS can't narrow the return type
      const localUser = await getLocalE2EUserFromRequest(env, request);
      if (localUser) {
        const user = {
          userId: localUser.id,
          role: localUser.role,
          email: localUser.email,
          name: localUser.name,
        };
        setApiUser({ id: user.userId, email: user.email, role: user.role });
        return { user };
      }

      const auth = await getAuth(env);

      let session: Awaited<ReturnType<typeof auth.api.getSession>>;
      try {
        session = await auth.api.getSession({ headers: request.headers });
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'auth.getSession',
          tags: { path: new URL(request.url).pathname },
          extra: { httpStatus: 500, errorCode: 'AUTH_SESSION_UNAVAILABLE' },
        });
        return status(500, { error: 'Authentication service unavailable' });
      }

      if (!session) {
        apiAddBreadcrumb({
          category: 'auth',
          message: 'Unauthenticated request rejected',
          level: 'warning',
          data: { path: new URL(request.url).pathname, method: request.method },
        });
        return status(401, { error: 'Unauthorized' });
      }

      const user = {
        userId: session.user.id,
        role: (session.user as unknown as { role?: string }).role ?? 'USER',
        email: session.user.email,
        name: session.user.name,
      };

      // Attach user to the Sentry scope for this request so all subsequent
      // captures are automatically associated with the authenticated user.
      setApiUser({ id: user.userId, email: user.email, role: user.role });

      return { user };
    },
  },
});

/**
 * Macro that additionally enforces ADMIN role.
 */
export const adminAuthPlugin = new Elysia({ name: 'packrat-admin-auth' }).macro({
  isAdmin: {
    resolve: async ({ request }: { request: Request }) => {
      const env = getEnv() as ValidatedEnv; // safe-cast: Worker env validated at startup; TS can't narrow the return type
      const localUser = await getLocalE2EUserFromRequest(env, request);
      if (localUser) return status(403, { error: 'Forbidden' });

      const auth = await getAuth(env);

      let session: Awaited<ReturnType<typeof auth.api.getSession>>;
      try {
        session = await auth.api.getSession({ headers: request.headers });
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'adminAuth.getSession',
          tags: { path: new URL(request.url).pathname },
          extra: { httpStatus: 500, errorCode: 'AUTH_SESSION_UNAVAILABLE' },
        });
        return status(500, { error: 'Authentication service unavailable' });
      }

      if (!session) return status(401, { error: 'Unauthorized' });

      const role = (session.user as unknown as { role?: string }).role;
      if (role !== 'ADMIN') {
        apiAddBreadcrumb({
          category: 'auth',
          message: 'Admin access denied',
          level: 'warning',
          data: { userId: session.user.id, role, path: new URL(request.url).pathname },
        });
        return status(403, { error: 'Forbidden' });
      }

      setApiUser({ id: session.user.id, email: session.user.email, role: 'ADMIN' });

      return {
        user: {
          userId: session.user.id,
          role: 'ADMIN' as const,
          email: session.user.email,
          name: session.user.name,
        },
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
      apiAddBreadcrumb({
        category: 'auth',
        message: 'Invalid API key rejected',
        level: 'warning',
        data: { path: new URL(request.url).pathname },
      });
      return status(401, { error: 'Unauthorized' });
    },
  },
});
