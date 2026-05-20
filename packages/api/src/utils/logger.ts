// Thin structured-logger surface for the API worker.
//
// Two reasons this exists instead of bare console.log calls:
//   1. Structured JSON lines are searchable in Workers logpush without
//      regex parsing. A consistent { level, event, ...ctx } shape lets
//      operators pivot on `event="etl.embedding.fallback"` in seconds.
//   2. When @sentry/cloudflare is wired in a follow-up, the breadcrumb
//      + captureException calls slot in at the emit() boundary; every
//      call site upgrades for free.
//
// The error_stack contract: error messages MUST NOT include raw CSV row
// data. Logger functions accept a structured `ctx` so callers pass jobId,
// chunkIndex, etc. without smuggling row content into stringified errors.
// To log an Error, attach it under the `err` key of ctx — the emit()
// boundary unpacks it into errorName/errorMessage/errorStack fields.

export type LogContext = Record<string, unknown> & { err?: unknown };

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

type EmitArgs = { level: LogLevel; event: string; ctx?: LogContext };

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
  const out = JSON.stringify(line);
  if (level === 'ERROR') {
    console.error(out);
  } else if (level === 'WARN') {
    console.warn(out);
  } else {
    console.log(out);
  }
}

export const logger = {
  info(event: string, ctx?: LogContext): void {
    emit({ level: 'INFO', event, ctx });
  },
  warn(event: string, ctx?: LogContext): void {
    emit({ level: 'WARN', event, ctx });
  },
  error(event: string, ctx?: LogContext): void {
    emit({ level: 'ERROR', event, ctx });
  },
};
