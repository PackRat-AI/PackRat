/**
 * U15 — observability tests.
 *
 * Scope:
 *  - `createLogger` emits one JSON object per call with the canonical
 *    `{ ts, level, msg, correlationId, service }` field set; user fields
 *    pass through after `scrubFields` filtering.
 *  - `scrubFields` default-deny: known keys pass through, unknown keys
 *    collapse to `'[redacted]'`. Nested allowlist for `actor`/`target`/
 *    `error` allows the documented sub-fields and redacts everything else.
 *  - `correlationIdFrom` prefers `cf-ray` and falls back to a UUID.
 *  - `attachCorrelationId` / `getCorrelationId` round-trip via the
 *    per-request WeakMap.
 *  - The OAuth provider's `onError` hook (verified live via a
 *    `console.warn` spy) emits a WARN-level structured log containing
 *    `oauthCode`, `oauthStatus`, and `description`, and never the
 *    request body, props, or token.
 *  - A successful `packrat_admin_hard_delete_user` invocation emits an
 *    `mcp.audit.admin_hard_delete_user` line carrying `actor.userId`,
 *    `target.id`, `outcome: 'success'`, and no input-arg leakage.
 *  - `runScheduledPurge` emits the start / batch / complete trio of
 *    structured logs.
 *  - `audit` wraps `logger.info` and uses the `mcp.audit.<action>` namespace.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachCorrelationId,
  audit,
  correlationIdFrom,
  createLogger,
  getCorrelationId,
  scrubFields,
  syntheticCorrelationId,
} from '../observability';
import { registerAdminTools } from '../tools/admin';
import type { AgentContext, Env } from '../types';

// ── Shared log-spy helpers ───────────────────────────────────────────────────

type CapturedLine = { level: 'log' | 'warn' | 'error'; json: Record<string, unknown> };

function captureLogs(): { lines: CapturedLine[]; restore: () => void } {
  const lines: CapturedLine[] = [];
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = (msg: unknown) =>
    lines.push({
      level: 'log',
      json: typeof msg === 'string' ? JSON.parse(msg) : (msg as Record<string, unknown>),
    });
  console.warn = (msg: unknown) =>
    lines.push({
      level: 'warn',
      json: typeof msg === 'string' ? JSON.parse(msg) : (msg as Record<string, unknown>),
    });
  console.error = (msg: unknown) =>
    lines.push({
      level: 'error',
      json: typeof msg === 'string' ? JSON.parse(msg) : (msg as Record<string, unknown>),
    });
  return {
    lines,
    restore: () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    },
  };
}

// ── createLogger ─────────────────────────────────────────────────────────────

describe('createLogger', () => {
  let capture: ReturnType<typeof captureLogs>;
  beforeEach(() => {
    capture = captureLogs();
  });
  afterEach(() => capture.restore());

  it('emits one JSON object per call with ts, level, msg, correlationId, service', () => {
    const log = createLogger({ correlationId: 'cf-ray-abc' });
    log.info('hello', { statusCode: 200 });
    expect(capture.lines).toHaveLength(1);
    const { json, level } = capture.lines[0];
    expect(level).toBe('log');
    expect(json.level).toBe('info');
    expect(json.msg).toBe('hello');
    expect(json.correlationId).toBe('cf-ray-abc');
    expect(json.service).toBe('mcp');
    expect(typeof json.ts).toBe('string');
    expect(json.statusCode).toBe(200);
  });

  it('uses the user-supplied service name when provided', () => {
    const log = createLogger({ correlationId: 'c1', service: 'mcp-test' });
    log.info('x');
    expect(capture.lines[0].json.service).toBe('mcp-test');
  });

  it('routes warn to console.warn and error to console.error', () => {
    const log = createLogger({ correlationId: 'c1' });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    const levels = capture.lines.map((l) => l.level);
    expect(levels).toEqual(['log', 'log', 'warn', 'error']);
    const jsonLevels = capture.lines.map((l) => l.json.level);
    expect(jsonLevels).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('default-deny: an unknown field becomes "[redacted]" but the key is preserved', () => {
    const log = createLogger({ correlationId: 'c1' });
    // Common slip: developer logs the bearer token alongside a safe field.
    log.info('failed', { token: 'super-secret', userId: 'u1' });
    // Note: `userId` is not in the top-level allowlist (only nested under
    // `actor`), so it should also be redacted. This is the intended
    // strict behavior: every direct top-level field must be explicitly
    // approved.
    const { json } = capture.lines[0];
    expect(json.token).toBe('[redacted]');
    expect(json.userId).toBe('[redacted]');
    // The original safe `correlationId` survives because it's set by the
    // logger itself, not by the caller.
    expect(json.correlationId).toBe('c1');
  });

  it('scrubs unknown nested keys under actor/target/error', () => {
    const log = createLogger({ correlationId: 'c1' });
    log.info('audit', {
      actor: { userId: 'u1', scopes: ['mcp:admin'], secret: 'nope' },
      target: { type: 'user', id: 'u-42', secret: 'nope' },
      error: { code: 'e', message: 'm', retryable: false, secret: 'nope' },
    });
    const { json } = capture.lines[0];
    expect(json.actor).toEqual({ userId: 'u1', scopes: ['mcp:admin'], secret: '[redacted]' });
    expect(json.target).toEqual({ type: 'user', id: 'u-42', secret: '[redacted]' });
    expect(json.error).toMatchObject({
      code: 'e',
      message: 'm',
      retryable: false,
      secret: '[redacted]',
    });
  });
});

// ── scrubFields directly ─────────────────────────────────────────────────────

describe('scrubFields', () => {
  it('returns an empty object on undefined input', () => {
    expect(scrubFields(undefined)).toEqual({});
  });

  it('drops function values entirely (never logged)', () => {
    const out = scrubFields({ statusCode: 200, callback: () => 1 });
    expect(out).not.toHaveProperty('callback');
    expect(out.statusCode).toBe(200);
  });

  it('passes through allowlisted scalars unchanged', () => {
    expect(scrubFields({ statusCode: 401, code: 'rate_limited', retryable: true })).toEqual({
      statusCode: 401,
      code: 'rate_limited',
      retryable: true,
    });
  });

  it('redacts a free-form bag of unknown keys', () => {
    expect(
      scrubFields({
        password: 'p',
        email: 'a@b.c',
        ip: '1.2.3.4',
        Authorization: 'Bearer x',
      }),
    ).toEqual({
      password: '[redacted]',
      email: '[redacted]',
      ip: '[redacted]',
      Authorization: '[redacted]',
    });
  });
});

// ── correlationIdFrom + WeakMap stash ───────────────────────────────────────

describe('correlationIdFrom', () => {
  it('prefers the cf-ray header when present', () => {
    const req = new Request('https://x/', { headers: { 'cf-ray': 'ray-42' } });
    expect(correlationIdFrom(req)).toBe('ray-42');
  });

  it('falls back to a UUID-shaped string when cf-ray is absent', () => {
    const req = new Request('https://x/');
    const id = correlationIdFrom(req);
    // RFC 4122 UUID: 8-4-4-4-12 hex with dashes
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('falls back when cf-ray exceeds the bounded length cap (defensive)', () => {
    const req = new Request('https://x/', { headers: { 'cf-ray': 'r'.repeat(2000) } });
    const id = correlationIdFrom(req);
    expect(id).not.toMatch(/^r{2000}$/);
    expect(id).toMatch(/^[0-9a-f-]+$/i);
  });
});

describe('attachCorrelationId / getCorrelationId WeakMap', () => {
  it('round-trips an attached id', () => {
    const req = new Request('https://x/');
    attachCorrelationId(req, 'corr-1');
    expect(getCorrelationId(req)).toBe('corr-1');
  });

  it('returns undefined when no id was attached', () => {
    const req = new Request('https://x/');
    expect(getCorrelationId(req)).toBeUndefined();
  });
});

// ── audit wrapper ───────────────────────────────────────────────────────────

describe('audit', () => {
  let capture: ReturnType<typeof captureLogs>;
  beforeEach(() => {
    capture = captureLogs();
  });
  afterEach(() => capture.restore());

  it('emits an `mcp.audit.<action>` line via the supplied logger', () => {
    const log = createLogger({ correlationId: 'c1' });
    audit(log, 'admin_hard_delete_user', {
      actor: { userId: 'u1', scopes: ['mcp:admin'] },
      target: { type: 'user', id: 'u-42' },
      outcome: 'success',
    });
    expect(capture.lines).toHaveLength(1);
    const { json } = capture.lines[0];
    expect(json.msg).toBe('mcp.audit.admin_hard_delete_user');
    expect(json.action).toBe('admin_hard_delete_user');
    expect(json.actor).toEqual({ userId: 'u1', scopes: ['mcp:admin'] });
    expect(json.target).toEqual({ type: 'user', id: 'u-42' });
    expect(json.outcome).toBe('success');
  });
});

// ── syntheticCorrelationId ──────────────────────────────────────────────────

describe('syntheticCorrelationId', () => {
  it('uses the kind as a prefix with a timestamp suffix', () => {
    const id = syntheticCorrelationId('cron');
    expect(id).toMatch(/^cron:\d+$/);
  });
});

// ── OAuthProvider onError shape (deleted in U3+U4) ──────────────────────────
// The library + its onError hook were removed in the Better Auth cutover.
// The API worker now owns OAuth-provider errors; tests for that surface live
// in `packages/api`. Kept the describe shell here as `.skip` for one release
// so the U6 test rewrite can intentionally delete it.

describe.skip('OAuthProvider onError hook (deleted in U3+U4)', () => {
  let capture: ReturnType<typeof captureLogs>;
  beforeEach(() => {
    capture = captureLogs();
  });
  afterEach(() => capture.restore());

  it('emits a WARN-level structured log with code/status/description', () => {
    // Mirror the lambda body from index.ts. Synthesised correlation ID
    // via `oauth:<timestamp>` because the hook signature in
    // @cloudflare/workers-oauth-provider 0.7.0 does not expose the
    // inbound Request — verified in the dist d.ts at
    // node_modules/@cloudflare/workers-oauth-provider/dist/oauth-provider.d.ts:556.
    // Operators correlate via `cf-ray` echo from Workers Logs.
    const onError = ({
      code,
      description,
      status,
      internal,
    }: {
      code: string;
      description: string;
      status: number;
      headers: Record<string, string>;
      internal?: { category: string; reason: string; detail?: unknown };
    }) => {
      const log = createLogger({ correlationId: syntheticCorrelationId('oauth') });
      log.warn('mcp.oauth.error', {
        oauthCode: code,
        oauthStatus: status,
        description,
        ...(internal
          ? { error: { code: internal.category, message: internal.reason, retryable: false } }
          : {}),
      });
    };
    onError({
      code: 'invalid_grant',
      description: 'Authorization code expired',
      status: 400,
      headers: { 'X-Some': 'value' }, // must NOT appear in the log
    });
    expect(capture.lines).toHaveLength(1);
    const line = capture.lines[0];
    expect(line.level).toBe('warn');
    expect(line.json.level).toBe('warn');
    expect(line.json.msg).toBe('mcp.oauth.error');
    expect(line.json.oauthCode).toBe('invalid_grant');
    expect(line.json.oauthStatus).toBe(400);
    expect(line.json.description).toBe('Authorization code expired');
    expect(String(line.json.correlationId)).toMatch(/^oauth:\d+$/);
    // Critical: no token, no headers, no request body in the line.
    expect(line.json).not.toHaveProperty('headers');
    expect(line.json).not.toHaveProperty('token');
    expect(line.json).not.toHaveProperty('props');
    expect(line.json).not.toHaveProperty('Authorization');
  });

  it('preserves internal { category, reason } when the library marks the error as internally tagged', () => {
    const onError = ({
      code,
      description,
      status,
      internal,
    }: {
      code: string;
      description: string;
      status: number;
      headers: Record<string, string>;
      internal?: { category: string; reason: string; detail?: unknown };
    }) => {
      const log = createLogger({ correlationId: syntheticCorrelationId('oauth') });
      log.warn('mcp.oauth.error', {
        oauthCode: code,
        oauthStatus: status,
        description,
        ...(internal
          ? { error: { code: internal.category, message: internal.reason, retryable: false } }
          : {}),
      });
    };
    onError({
      code: 'invalid_token',
      description: 'Token validation failed',
      status: 401,
      headers: {},
      internal: { category: 'jwt_validation', reason: 'signature_mismatch', detail: { kid: 'k1' } },
    });
    const { json } = capture.lines[0];
    expect(json.error).toEqual({
      code: 'jwt_validation',
      message: 'signature_mismatch',
      retryable: false,
    });
    // `detail` is dropped — it can carry arbitrary issuer-side material.
    expect(JSON.stringify(json)).not.toContain('kid');
  });
});

// ── Admin tool audit log (live registration + tool invocation) ──────────────
//
// Re-uses the stub-api pattern from `tools-admin.test.ts` so this test
// stays in shape with the elicitation coverage and we can assert the audit
// emission alongside the API call. Kept self-contained so a future
// reshuffle of either file doesn't entangle them.

type ApiCall = { path: string[]; args: unknown[] };
const HTTP_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete']);

function makeApiStub(): { api: AgentContext['api']; calls: ApiCall[] } {
  const calls: ApiCall[] = [];
  const make = (path: string[]): unknown => {
    const target = (...args: unknown[]) => {
      const last = path.at(-1) ?? '';
      calls.push({ path, args });
      if (HTTP_VERBS.has(last)) {
        return Promise.resolve({ data: { success: true }, error: null, status: 200 });
      }
      return make([...path, '()']);
    };
    return new Proxy(target, {
      get: (_t, prop) => (prop === 'then' ? undefined : make([...path, String(prop)])),
      // biome-ignore lint/complexity/useMaxParams: Proxy `apply` shape is fixed by the ECMAScript spec.
      apply: (_t, _this, args) => {
        const last = path.at(-1) ?? '';
        calls.push({ path, args });
        if (HTTP_VERBS.has(last)) {
          return Promise.resolve({ data: { success: true }, error: null, status: 200 });
        }
        return make([...path, '()']);
      },
    });
  };
  return { api: make([]) as AgentContext['api'], calls };
}

function makeAgentWithAudit(): {
  agent: AgentContext;
  server: McpServer;
} {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const { api } = makeApiStub();
  const agent: AgentContext = {
    server,
    api,
    apiBaseUrl: 'https://api.test',
    setFeatureFlag: () => {
      /* no-op */
    },
    registerFlaggedTool: (_flag, ...args) =>
      (server.registerTool as (...a: unknown[]) => ReturnType<typeof server.registerTool>)(...args),
    elicitInput: vi.fn().mockResolvedValue({
      action: 'accept',
      content: { confirmation: 'u-42' },
    }),
    getAuditContext: () => ({
      userId: 'admin-u1',
      scopes: ['mcp:admin', 'mcp:write'],
      correlationId: 'session:do-id-7',
    }),
  };
  return { agent, server };
}

function getToolHandler(
  server: McpServer,
  name: string,
): (
  args: Record<string, unknown>,
  extra: { requestId: RequestId; signal: AbortSignal },
) => Promise<unknown> {
  const internal = server as unknown as {
    _registeredTools: Record<string, { handler?: unknown; callback?: unknown }>;
  };
  const tool = internal._registeredTools[name];
  if (!tool) throw new Error(`tool not registered: ${name}`);
  const fn = tool.handler ?? tool.callback;
  if (typeof fn !== 'function') throw new Error(`tool ${name} has no handler`);
  return fn as (
    args: Record<string, unknown>,
    extra: { requestId: RequestId; signal: AbortSignal },
  ) => Promise<unknown>;
}

describe('admin tool audit log — packrat_admin_hard_delete_user', () => {
  let capture: ReturnType<typeof captureLogs>;
  beforeEach(() => {
    capture = captureLogs();
  });
  afterEach(() => capture.restore());

  it('emits an audit log with action, actor.userId, target.id, outcome=success on a successful invocation', async () => {
    const { agent, server } = makeAgentWithAudit();
    registerAdminTools(agent);
    const tool = getToolHandler(server, 'packrat_admin_hard_delete_user');
    await tool(
      { user_id: 'u-42', reason: 'GDPR request #1' },
      { requestId: 'r-1', signal: new AbortController().signal },
    );

    const audits = capture.lines.filter((l) =>
      String(l.json.msg).startsWith('mcp.audit.admin_hard_delete_user'),
    );
    expect(audits).toHaveLength(1);
    const line = audits[0];
    expect(line.json.action).toBe('admin_hard_delete_user');
    expect(line.json.outcome).toBe('success');
    expect(line.json.actor).toEqual({
      userId: 'admin-u1',
      scopes: ['mcp:admin', 'mcp:write'],
    });
    expect(line.json.target).toEqual({ type: 'user', id: 'u-42' });
    expect(line.json.correlationId).toBe('session:do-id-7');
    // Critical: the `reason` input arg must NOT be present in the audit
    // line. Only the target id is captured.
    expect(line.json).not.toHaveProperty('reason');
    expect(JSON.stringify(line.json)).not.toContain('GDPR request');
  });

  it('emits outcome=declined when the elicitation is cancelled — and never logs the input args', async () => {
    const { agent, server } = makeAgentWithAudit();
    (agent.elicitInput as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ action: 'cancel' });
    registerAdminTools(agent);
    const tool = getToolHandler(server, 'packrat_admin_hard_delete_user');
    await tool(
      { user_id: 'u-42', reason: 'r' },
      { requestId: 'r-2', signal: new AbortController().signal },
    );
    const audits = capture.lines.filter((l) =>
      String(l.json.msg).startsWith('mcp.audit.admin_hard_delete_user'),
    );
    expect(audits).toHaveLength(1);
    expect(audits[0].json.outcome).toBe('declined');
    expect(audits[0].json.error).toMatchObject({ code: 'user_cancelled' });
  });
});

// ── Scheduled handler logging (deleted in U3+U4) ────────────────────────────
// `runScheduledPurge` was deleted; KV cleanup is owned by Better Auth on the
// API worker side. Skipped pending U6 deletion.

describe.skip('runScheduledPurge structured logging (deleted in U3+U4)', () => {
  let capture: ReturnType<typeof captureLogs>;
  beforeEach(() => {
    capture = captureLogs();
  });
  afterEach(() => capture.restore());

  it('logs entry, per-batch results, and completion', async () => {
    let calls = 0;
    const provider = {
      purgeExpiredData: vi.fn(async () => {
        calls += 1;
        return {
          grantsChecked: 10,
          grantsPurged: 3,
          tokensChecked: 8,
          tokensPurged: 2,
          done: calls >= 2,
        };
      }),
    };
    const env = {
      PackRatMCP: {} as Env['PackRatMCP'],
      PACKRAT_API_URL: 'https://api.test',
      OAUTH_KV: {} as Env['OAUTH_KV'],
      OAUTH_PROVIDER: {} as Env['OAUTH_PROVIDER'],
    } satisfies Env;
    await runScheduledPurge(provider, env);

    const msgs = capture.lines.map((l) => l.json.msg);
    expect(msgs).toContain('mcp.cron.purge.start');
    expect(msgs.filter((m) => m === 'mcp.cron.purge.batch')).toHaveLength(2);
    expect(msgs).toContain('mcp.cron.purge.complete');
    // Per-batch payloads carry the grants/tokens counters straight from
    // PurgeResult (no synthesis).
    const batches = capture.lines.filter((l) => l.json.msg === 'mcp.cron.purge.batch');
    expect(batches[0].json.grantsPurged).toBe(3);
    expect(batches[0].json.tokensPurged).toBe(2);
    // All cron lines share a `cron:<timestamp>` correlationId.
    const cronLines = capture.lines.filter((l) => String(l.json.msg).startsWith('mcp.cron.purge.'));
    for (const line of cronLines) {
      expect(String(line.json.correlationId)).toMatch(/^cron:\d+$/);
    }
  });

  it('emits a cap-reached WARN when iterations exhaust without done=true', async () => {
    const provider = {
      purgeExpiredData: vi.fn(async () => ({
        grantsChecked: 10,
        grantsPurged: 1,
        tokensChecked: 10,
        tokensPurged: 1,
        done: false,
      })),
    };
    const env = {
      PackRatMCP: {} as Env['PackRatMCP'],
      PACKRAT_API_URL: 'https://api.test',
      OAUTH_KV: {} as Env['OAUTH_KV'],
      OAUTH_PROVIDER: {} as Env['OAUTH_PROVIDER'],
    } satisfies Env;
    await runScheduledPurge(provider, env);
    const warn = capture.lines.find(
      (l) => l.level === 'warn' && l.json.msg === 'mcp.cron.purge.cap_reached',
    );
    expect(warn).toBeDefined();
    expect(warn?.json.cap).toBe(50);
  });
});
