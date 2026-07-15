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
  getCurrentScope,
  setUser,
  startSpan,
  withScope,
} from '@sentry/cloudflare';

export {
  addBreadcrumb,
  captureException,
  captureMessage,
  getCurrentScope,
  setUser,
  startSpan,
  withScope,
};

export type SentryOperationContext = {
  operation: string;
  userId?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

/**
 * Dedup set. PackRat has three overlapping Sentry boundaries on Workers:
 *   1. `withSentry` (index.ts) — outer net over fetch/queue/scheduled.
 *   2. `instrumentWorkflowWithSentry` (index.ts) — workflow entrypoints.
 *   3. Elysia `.onError` (app.ts) — route handlers.
 *
 * When inner code enriches an error with `captureApiException`/`record` and
 * then rethrows, the boundary it propagates into would report it a second
 * time. We track reported errors here and skip repeats, so enrich-and-rethrow
 * is safe to use anywhere.
 *
 * A `WeakSet` (rather than a stamped symbol) avoids mutating — possibly
 * frozen — error objects and is GC-friendly. The api worker is a single
 * bundle, so all three boundaries share this instance.
 */
const capturedErrors = new WeakSet<object>();

// `instanceof Object` (not @packrat/guards' isObject, which is plain-object
// only) so Error instances — the primary thing we dedup — are covered, while
// primitives (string/number throws) are skipped. WeakSet needs an object key.
function markCaptured(error: unknown): void {
  if (error instanceof Object) capturedErrors.add(error);
}

/** True if our helpers have already reported this error to Sentry. */
export function isCaptured(error: unknown): boolean {
  return error instanceof Object && capturedErrors.has(error);
}

/**
 * Capture an exception with structured operation context.
 * Logs to console as well so wrangler dev output is still useful.
 *
 * Idempotent: an error already reported by our helpers is skipped, so the
 * route/workflow/worker boundaries don't double-report errors that inner code
 * already enriched (see `capturedErrors`). Attaches to the active span when one is
 * open (e.g. inside `record`).
 *
 * Use this directly only for catches that intentionally SWALLOW the error
 * (fail-closed `return false`, best-effort metrics). For an operation you
 * rethrow from, prefer `record` so it also gets a span.
 */
export function captureApiException(opts: { error: unknown } & SentryOperationContext): void {
  const { error, operation, userId, tags, extra } = opts;

  if (isCaptured(error)) return;
  markCaptured(error);

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
 * Instrument a sub-operation: open a Sentry span (Sentry's tracing is
 * OpenTelemetry-semantic and Workers-native), run `fn`, and on failure mark
 * the span errored, capture the exception with context, and rethrow.
 *
 * This mirrors `@elysiajs/opentelemetry`'s `record(name, fn)` ergonomics, but
 * the Elysia OTel plugin depends on the Node OTel SDK, which does not run on
 * workerd — so we back it with `@sentry/cloudflare`, the tracer already
 * deployed via `withSentry`. One primitive = span + enriched, idempotent,
 * deduped error capture.
 *
 * Use at boundaries the framework's auto-capture can't enrich: workflow
 * `step.do` bodies, queue/cron consumers, and services called outside an
 * Elysia request. Inside a route handler you usually don't need this — let the
 * error propagate to `.onError`.
 */
export function record<T>(
  opts: SentryOperationContext & {
    // Span attributes must be primitive (Sentry's SpanAttributeValue); keep it
    // narrow rather than Record<string, unknown> so it's assignable to startSpan.
    attributes?: Record<string, string | number | boolean>;
    fn: () => Promise<T>;
  },
): Promise<T> {
  const { operation, attributes, fn, ...captureCtx } = opts;
  return startSpan({ name: operation, attributes }, async () => {
    try {
      return await fn();
    } catch (error) {
      captureApiException({ error, operation, ...captureCtx });
      throw error;
    }
  });
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
 * Tag the current request scope with a correlation id, so every Sentry event
 * raised during this request — the `.onError` report and every
 * `captureApiException`/`record` event — carries the same `request_id`.
 *
 * Set once per request in `app.ts`'s `.onRequest` from the Cloudflare `cf-ray`
 * header (also surfaced in the `X-Request-Id` response header and error body),
 * so a single value pivots Sentry, the CF dashboard, and a client bug report
 * to the same request. Complements Sentry's automatic `trace_id` with a
 * human-grep-able id.
 */
export function setRequestId(requestId: string): void {
  getCurrentScope().setTag('request_id', requestId);
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
