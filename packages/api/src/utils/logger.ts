// Thin structured-logger surface for the API worker.
//
// Two reasons this exists instead of bare console.log calls:
//   1. Structured JSON lines are searchable in Workers logpush without
//      regex parsing. A consistent { level, event, ...ctx } shape lets
//      operators pivot on `event="etl.embedding.fallback"` in seconds.
//   2. The emit() boundary forwards to @sentry/cloudflare when the SDK
//      has been initialized by withSentry() in src/index.ts:
//        - INFO/WARN → Sentry.addBreadcrumb (correlated with the next
//          captureException if one fires)
//        - ERROR with ctx.err → Sentry.captureException with tags from
//          ctx (jobId, chunkIndex, workflowInstanceId, etc.)
//        - ERROR without ctx.err → Sentry.captureMessage at error level
//      isInitialized() returns false during unit tests or before withSentry
//      runs, in which case Sentry calls are skipped silently.
//
// The error_stack contract: error messages MUST NOT include raw CSV row
// data. Logger functions accept a structured `ctx` so callers pass jobId,
// chunkIndex, etc. without smuggling row content into stringified errors.
// To log an Error, attach it under the `err` key of ctx — the emit()
// boundary unpacks it into errorName/errorMessage/errorStack fields and
// forwards to Sentry.

import { isNumber, isString } from '@packrat/guards';
import { configureJsonStringify, safeJsonStringify } from '@packrat/utils';
import { addBreadcrumb, captureException, captureMessage, isInitialized } from '@sentry/cloudflare';

// Stringifier that THROWS on circular structures (like raw JSON.stringify), so
// the emit() fallback below can detect un-serializable ctx and emit a
// serializationError line instead of silently writing a `[Circular]` placeholder.
const stringifyOrThrow = configureJsonStringify({
  circularValue: Error,
  bigint: true,
  deterministic: false,
});

export type LogContext = Record<string, unknown> & { err?: unknown };

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

type EmitArgs = { level: LogLevel; event: string; ctx?: LogContext };

function forwardToSentry({ level, event, ctx }: EmitArgs): void {
  // The Sentry SDK throws if it's accessed before withSentry has initialized
  // the client (e.g., in unit tests or during cold-start). Skip silently in
  // that case — console output above is still the durable record.
  if (!isInitialized()) return;

  const sentryTags: Record<string, string> = {};
  const sentryExtras: Record<string, unknown> = { event };
  let err: unknown;
  if (ctx) {
    for (const [k, v] of Object.entries(ctx)) {
      if (k === 'err') {
        err = v;
        continue;
      }
      if (isString(v) || isNumber(v) || v === true || v === false) {
        sentryTags[k] = String(v);
      } else {
        sentryExtras[k] = v;
      }
    }
  }

  if (level === 'ERROR') {
    if (err !== undefined) {
      captureException(err, { tags: { event, ...sentryTags }, extra: sentryExtras });
    } else {
      captureMessage(event, { level: 'error', tags: sentryTags, extra: sentryExtras });
    }
    return;
  }

  addBreadcrumb({
    category: event,
    level: level === 'WARN' ? 'warning' : 'info',
    data: { ...sentryTags, ...sentryExtras },
  });
}

function emit({ level, event, ctx }: EmitArgs): void {
  const line: Record<string, unknown> = {
    level,
    event,
    ts: new Date().toISOString(),
  };
  if (ctx) {
    for (const [k, v] of Object.entries(ctx)) {
      if (k === 'err') continue;
      line[k] = v;
    }
    const err = ctx.err;
    if (err !== undefined) {
      if (err instanceof Error) {
        line.errorName = err.name;
        line.errorMessage = err.message;
        if (err.stack) line.errorStack = err.stack;
      } else {
        line.errorMessage = String(err);
      }
    }
  }
  let out: string;
  try {
    out = stringifyOrThrow(line);
  } catch {
    out = safeJsonStringify({ level, event, ts: line.ts, serializationError: true });
  }
  if (level === 'ERROR') {
    console.error(out);
  } else if (level === 'WARN') {
    console.warn(out);
  } else {
    console.log(out);
  }

  // Best-effort forward to Sentry; failures here must never break the call
  // site (the JSON line is already on console).
  try {
    forwardToSentry({ level, event, ctx });
  } catch {
    // swallow — Sentry forwarding is observability, not correctness
  }
}

export const logger = {
  info({ event, ctx }: { event: string; ctx?: LogContext }): void {
    emit({ level: 'INFO', event, ctx });
  },
  warn({ event, ctx }: { event: string; ctx?: LogContext }): void {
    emit({ level: 'WARN', event, ctx });
  },
  error({ event, ctx }: { event: string; ctx?: LogContext }): void {
    emit({ level: 'ERROR', event, ctx });
  },
};
