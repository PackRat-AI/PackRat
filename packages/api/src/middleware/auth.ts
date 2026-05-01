import { getAuth } from '@packrat/api/auth';
import { isValidApiKey } from '@packrat/api/utils/auth';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
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
      const auth = await getAuth(env);
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return status(401, { error: 'Unauthorized' });

      return {
        user: {
          userId: session.user.id,
          role: (session.user as unknown as { role?: string }).role ?? 'USER',
          email: session.user.email,
          name: session.user.name,
        },
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
      const env = getEnv() as ValidatedEnv; // safe-cast: Worker env validated at startup; TS can't narrow the return type
      const auth = await getAuth(env);
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return status(401, { error: 'Unauthorized' });

      const role = (session.user as unknown as { role?: string }).role;
      if (role !== 'ADMIN') return status(403, { error: 'Forbidden' });

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
      return status(401, { error: 'Unauthorized' });
    },
  },
});
