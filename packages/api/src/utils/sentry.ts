/**
 * Sentry helpers for the PackRat API (Cloudflare Workers).
 *
 * `withSentry` in index.ts initialises Sentry per-request via AsyncLocalStorage,
 * so every function here safely operates on the current request scope.
 */

import {
  addBreadcrumb,
  captureException,
  captureMessage,
  setUser,
  withScope,
} from '@sentry/cloudflare';

export { addBreadcrumb, captureException, captureMessage, setUser, withScope };

export type SentryOperationContext = {
  operation: string;
  userId?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

/**
 * Capture an exception with structured operation context.
 * Logs to console as well so wrangler dev output is still useful.
 */
export function captureApiException(error: unknown, ctx: SentryOperationContext): void {
  const { operation, userId, tags, extra } = ctx;

  withScope((scope) => {
    scope.setTag('operation', operation);
    // Use a tag for userId rather than setUser to avoid overwriting richer
    // user context (email/role) already set on the scope by setApiUser.
    if (userId) scope.setTag('user_id', userId);
    if (tags) {
      for (const [k, v] of Object.entries(tags)) scope.setTag(k, v);
    }
    if (extra) {
      for (const [k, v] of Object.entries(extra)) scope.setExtra(k, v);
    }
    captureException(error);
  });

  console.error(`[sentry][${operation}]`, error);
}

/**
 * Add a structured breadcrumb. Falls back gracefully when Sentry is not init.
 */
export function apiAddBreadcrumb(opts: {
  category: string;
  message: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void {
  addBreadcrumb({ type: 'default', ...opts });
}

/**
 * Set the authenticated user on the current request scope.
 */
export function setApiUser(user: { id: string; email: string; role: string }): void {
  setUser({ id: user.id, email: user.email, username: user.role });
}

/**
 * Clear user context (e.g. on sign-out or 401).
 */
export function clearApiUser(): void {
  setUser(null);
}
