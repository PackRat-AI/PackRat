/**
 * U15 — structured logging, correlation IDs, and audit logs.
 *
 * The MCP Worker has no in-process Sentry SDK. Telemetry pipeline:
 *
 *   structured `console.log/warn/error` → Workers Logs → Cloudflare-dashboard
 *   OTel pipeline → Sentry OTLP endpoint.
 *
 * The OTel pipeline is configured in the Cloudflare dashboard (see
 * `docs/mcp/runbook.md` § "U15 observability"). The code-level requirement
 * is only that we emit one JSON object per log line with a canonical field
 * set — Workers Logs ingests these as structured events and the pipeline
 * forwards them downstream.
 *
 * What this module ships:
 *
 *   - `createLogger({ correlationId, service })` — typed logger that
 *     emits JSON on each call. `level` is the log severity; everything
 *     else lands as a structured field. Tokens and PII MUST NEVER reach
 *     the logger — `scrubFields` enforces a default-deny allowlist so an
 *     accidental `logger.info('failed', { token: bearer })` redacts the
 *     token before it leaves the worker.
 *
 *   - `correlationIdFrom(request)` — derives a stable per-request ID.
 *     Prefers `cf-ray` (every Cloudflare-fronted request has one and it
 *     correlates 1-1 with the upstream zone/edge log line); falls back to
 *     `crypto.randomUUID()` for off-CF tests.
 *
 *   - `attachCorrelationId(request, id)` / `getCorrelationId(request)` —
 *     stash the id on a per-request WeakMap so deep handlers can read it
 *     back without plumbing the id through every function signature. We
 *     pick a WeakMap (not AsyncLocalStorage) because (a) Workers runtime
 *     ALS support is still gated behind a compatibility flag we don't
 *     set today and (b) every request is a Request object reachable from
 *     the handler, so the lookup is O(1) without runtime surprises.
 *
 *   - `audit(logger, action, fields)` — thin wrapper around `logger.info`
 *     that emits a canonical `mcp.audit.<action>` line. The wrapper exists
 *     so every admin tool's audit call reads identically, and a future
 *     dashboard filter can pivot on the `mcp.audit.` namespace.
 *
 * Redaction policy (default-deny allowlist):
 *
 *   The set of `AUDIT_FIELD_ALLOWLIST` keys below is the complete list
 *   of structured fields a tool / handler may emit. Anything else is
 *   replaced with the string `'[redacted]'` (we keep the *key* so
 *   reviewers can see "the caller tried to log X but it was scrubbed",
 *   which is a useful signal during incident triage). Nested objects are
 *   walked recursively at the leaf level — `actor.userId` is allowed,
 *   `actor.someOtherKey` is redacted.
 *
 *   What is NEVER logged: `betterAuthToken`, `props`, OAuth `code`,
 *   bearer tokens, refresh tokens, passwords, email addresses, IP
 *   addresses, full URLs (only the bounded path/origin is okay), the
 *   request/response body, the user's typed elicitation answer.
 */

import { isFunction, isObject } from '@packrat/guards';

// ── Public types ─────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogArgs = { msg: string; fields?: Record<string, unknown> };

export interface Logger {
  debug(args: LogArgs): void;
  info(args: LogArgs): void;
  warn(args: LogArgs): void;
  error(args: LogArgs): void;
}

export interface CreateLoggerOptions {
  correlationId: string;
  /** Service name; defaults to `'mcp'` for the PackRat MCP Worker. */
  service?: string;
}

// ── Allowlist — the complete set of structured fields we will emit ───────────

/**
 * Keys allowed at the top level of a log line's structured payload.
 *
 * Adding to this list is a deliberate operator decision: every new key
 * here is a key that will be forwarded to Sentry via the OTel pipeline,
 * and the audit-trail-leak risk grows with each addition. Anything not
 * in the set is replaced with `'[redacted]'` (key preserved so triage
 * can see "the caller tried to attach X but it was scrubbed").
 *
 * Why default-deny (allowlist) and not denylist? A denylist requires us
 * to enumerate every PII / secret shape, which is impossible to keep up
 * with as the API surface grows. The allowlist makes the addition of any
 * new structured-log field a code-review event, which is the property
 * we want for telemetry hygiene.
 */
const TOP_LEVEL_ALLOWLIST = new Set<string>([
  // Always-on context (set by createLogger, not by callers — included
  // here so the same scrubFields can be reused as a pre-emit validator).
  'correlationId',
  'service',
  'ts',
  'level',
  'msg',
  // Per-request structural context.
  'requestId',
  'method',
  'path',
  'statusCode',
  'duration',
  'iteration',
  'iterations',
  'done',
  // Error envelope shape (matches U8's `errResponse` natural fields).
  'code',
  'description',
  'reason',
  'retryable',
  // Auth surface — never the token, only the codes/statuses/reasons.
  'oauthCode',
  'oauthStatus',
  // Audit surface (see `audit` below).
  'action',
  'outcome',
  'actor',
  'target',
  'error',
  // Scheduled-cron surface (see scheduled.ts).
  'grantsChecked',
  'grantsPurged',
  'tokensChecked',
  'tokensPurged',
  'cap',
  // Tool surface.
  'tool',
  'toolName',
]);

/**
 * Nested keys allowed inside known-structured fields. We walk one level
 * deep so `actor.userId` and `target.id` survive but a caller that
 * stuffs the entire OAuth `props` into `actor` doesn't leak the token.
 */
const NESTED_ALLOWLIST: Record<string, Set<string>> = {
  actor: new Set(['userId', 'scopes']),
  target: new Set(['type', 'id']),
  error: new Set(['code', 'message', 'retryable']),
};

const REDACTED = '[redacted]' as const;

// ── Redaction ────────────────────────────────────────────────────────────────

/**
 * Walk a fields object and replace any key not in the top-level allowlist
 * (and any nested key not in `NESTED_ALLOWLIST[parent]`) with the literal
 * string `'[redacted]'`. The result is a NEW object — input is never
 * mutated.
 *
 * Behavior:
 *  - Allowlisted leaf values pass through unchanged (numbers, strings,
 *    booleans, null, arrays of primitives).
 *  - Allowlisted parent keys (`actor`, `target`, `error`) recurse one
 *    level into their nested allowlists; unrecognised nested keys are
 *    redacted but the parent key is preserved.
 *  - Anything else collapses to `'[redacted]'` (key preserved).
 *  - Function values are always dropped (they should never end up in a
 *    log line).
 *
 * Exported for the test suite — production callers should reach the
 * scrubbing through `createLogger` rather than calling this directly.
 */
export function scrubFields(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isFunction(value)) continue;
    if (!TOP_LEVEL_ALLOWLIST.has(key)) {
      out[key] = REDACTED;
      continue;
    }
    const nestedAllow = NESTED_ALLOWLIST[key];
    if (nestedAllow && isPlainObject(value)) {
      out[key] = scrubNested({ obj: value, allow: nestedAllow });
      continue;
    }
    out[key] = value;
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  // Arrays, Maps, Sets, Dates, etc. are NOT plain objects — they should
  // pass through unchanged at the top level (we trust the caller for
  // arrays of primitive scopes, etc.).
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function scrubNested({
  obj,
  allow,
}: {
  obj: Record<string, unknown>;
  allow: Set<string>;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isFunction(value)) continue;
    out[key] = allow.has(key) ? value : REDACTED;
  }
  return out;
}

// ── Logger ───────────────────────────────────────────────────────────────────

/**
 * Construct a per-request logger. Each invocation emits a single JSON
 * object on the corresponding console method:
 *
 *   - `debug` / `info` → `console.log`  (Workers Logs ingests both as INFO)
 *   - `warn`          → `console.warn`
 *   - `error`         → `console.error`
 *
 * The JSON shape is stable:
 *
 *   { ts, level, msg, correlationId, service?, ...scrubbedFields }
 *
 * `ts` is `new Date().toISOString()`. `level` is the canonical lowercase
 * severity. `correlationId` and `service` are pinned on every line so
 * Workers Logs filters can pivot on them without per-call instrumentation.
 *
 * Every user-supplied field passes through `scrubFields` (default-deny
 * allowlist) before emit — see the module docstring for the redaction
 * policy and what the allowlist covers.
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const { correlationId, service = 'mcp' } = opts;
  // Single object param `{ level, msg, fields }` — the public Logger methods and
  // every call site take one object, per the no-owned-max-params convention.
  function emit({
    level,
    msg,
    fields,
  }: {
    level: LogLevel;
    msg: string;
    fields?: Record<string, unknown>;
  }): void {
    const payload = {
      ts: new Date().toISOString(),
      level,
      msg,
      correlationId,
      service,
      ...scrubFields(fields),
    };
    const line = JSON.stringify(payload);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
  return {
    debug: ({ msg, fields }) => emit({ level: 'debug', msg, fields }),
    info: ({ msg, fields }) => emit({ level: 'info', msg, fields }),
    warn: ({ msg, fields }) => emit({ level: 'warn', msg, fields }),
    error: ({ msg, fields }) => emit({ level: 'error', msg, fields }),
  };
}

// ── Correlation IDs ──────────────────────────────────────────────────────────

/**
 * Derive a stable per-request correlation ID.
 *
 * Prefers `cf-ray` (every Cloudflare-fronted request carries one, and
 * the value matches what the zone-level Cloudflare logs use, so a
 * single value lets an operator pivot between Workers Logs / Sentry /
 * the Cloudflare dashboard for the same request). Falls back to
 * `crypto.randomUUID()` for off-CF tests or the rare in-flight retry
 * where the upstream stripped the header.
 *
 * The header value is *never* trusted as more than an identifier — it
 * doesn't drive any access-control decision. We do bound the length so
 * a malicious caller can't stuff a megabyte ID into our log lines.
 */
const MAX_CORRELATION_ID_LEN = 128;

export function correlationIdFrom(request: Request): string {
  const ray = request.headers.get('cf-ray');
  if (ray && ray.length > 0 && ray.length <= MAX_CORRELATION_ID_LEN) {
    return ray;
  }
  return crypto.randomUUID();
}

/**
 * Per-request WeakMap stashing the correlation ID on a Request object.
 *
 * Why a WeakMap (and not AsyncLocalStorage)? The Workers ALS support is
 * still gated behind the `nodejs_compat` / `nodejs_als` compatibility
 * flags we deliberately don't set today (see `wrangler.jsonc` — we
 * stay on the stock runtime). Every handler that needs the correlation
 * ID already has access to the Request object the outer wrapper saw,
 * so a `WeakMap<Request, string>` is the lightest plumbing that works.
 *
 * The map is module-scope but lifetime-bounded by the Request object —
 * once the request finishes and the Request is GC'd, the entry
 * disappears automatically. No manual cleanup needed.
 */
const correlationIdByRequest = new WeakMap<Request, string>();

export function attachCorrelationId({ request, id }: { request: Request; id: string }): void {
  correlationIdByRequest.set(request, id);
}

/**
 * Look up the correlation ID stashed on a Request by the outer fetch
 * wrapper. Returns `undefined` if no ID was attached (e.g. a unit-test
 * invocation that bypassed the wrapper). Callers should treat the
 * undefined case as "we don't have a correlation surface here" and
 * emit logs unattributed rather than fabricating an ID.
 */
export function getCorrelationId(request: Request): string | undefined {
  return correlationIdByRequest.get(request);
}

// ── Audit ────────────────────────────────────────────────────────────────────

/**
 * Canonical audit-log surface for admin tool invocations.
 *
 * Every admin-tool handler (see `tools/admin.ts` and the two pack-template
 * admin tools in `tools/packTemplates.ts`) wraps its execution with an
 * `audit(logger, '<tool>', { ... })` call. The shape is uniform:
 *
 *   {
 *     msg: 'mcp.audit.<action>',
 *     action: '<action>',
 *     actor: { userId, scopes },
 *     target: { type, id },
 *     outcome: 'success' | 'failure' | 'declined',
 *     error?: { code, retryable },     // only on failure
 *     correlationId,                    // pinned by the logger
 *   }
 *
 * `outcome: 'declined'` is used when an elicitation surface returned
 * `confirmed: false` — the action did not run, but the intent was made
 * known to the server and is worth recording.
 *
 * The `mcp.audit.` prefix on `msg` is the operator-facing namespace
 * filter for Sentry / Workers Logs. We use a real prefix string (not a
 * tag-only convention) because some log-pipeline configurations strip
 * tags on transit but the message text always survives.
 */
export function audit({
  logger,
  action,
  fields,
}: {
  logger: Logger;
  action: string;
  fields: Record<string, unknown>;
}): void {
  logger.info({ msg: `mcp.audit.${action}`, fields: { ...fields, action } });
}

/**
 * Build a synthetic correlation ID for code paths without an inbound
 * Request — today the only caller is the scheduled-handler cron sweep.
 *
 * Shape: `cron:<unix-ms>`. Distinct prefix so a Workers Logs query for
 * scheduled-handler events can pivot on the `cron:` namespace.
 */
export function syntheticCorrelationId(kind: string): string {
  return `${kind}:${Date.now()}`;
}
