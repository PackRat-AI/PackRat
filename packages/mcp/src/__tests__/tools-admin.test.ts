/**
 * U10 — integration-style tests for the destructive admin tools' elicitation
 * gating.
 *
 * Strategy: build a real `McpServer`, register the admin tools against a
 * stub `AgentContext` whose `api.admin` is a `Proxy` that records every
 * call, and exercise the tool handlers directly via the SDK's internal
 * registry. We then assert that:
 *
 *  1. When the elicitation resolves with the expected confirmation,
 *     the API DELETE call fires with the right user_id.
 *
 *  2. When the elicitation resolves with the wrong confirmation,
 *     the API call does NOT fire — only the elicitation prompt did —
 *     and the tool returns the `confirmation_mismatch` error envelope.
 *
 *  3. When the client doesn't support elicitations (the SDK throws
 *     'Client does not support elicitation'), the API call does NOT
 *     fire and the tool returns the `elicitation_unsupported` envelope.
 *
 * We also cover the two non-admin-prefix destructive tools that U10
 * gates: `packrat_create_app_pack_template` (PUBLISH) and
 * `packrat_generate_pack_template_from_url` (GENERATE).
 *
 * Why a stub api rather than spying on `call()` directly? `call()` is the
 * MCP-side error/envelope helper; the load-bearing thing is whether the
 * Treaty endpoint gets hit at all. A proxy that records the property
 * chain is the cleanest way to assert "the DELETE fired with the
 * matching id" without coupling to internal Treaty types.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';
import type { ElicitInputResult } from '../elicit';
import { registerAdminTools } from '../tools/admin';
import { registerPackTemplateTools } from '../tools/packTemplates';
import type { AgentContext } from '../types';
import { nth } from './_access';
import {
  firstText as hFirstText,
  getToolHandler as hGetToolHandler,
  makeAgent as hMakeAgent,
  makeExtra as hMakeExtra,
} from './_tool-harness';

// ── Stubs ────────────────────────────────────────────────────────────────────

/** Call record entry — every property access + final invocation is logged. */
type ApiCall = { path: string[]; args: unknown[] };

/**
 * Build an api proxy that records the property chain and final-call args.
 *
 * Each invocation on the proxy returns *another* proxy whose path is the
 * original path plus a synthetic `()` segment. This lets us chain things
 * like `admin.users({id}).hard.delete({reason})`: the `users({id})` call
 * returns another proxy (logged as a call), and `.hard.delete({reason})`
 * also resolves through the proxy. The terminal Treaty-style resolution
 * (`.delete()`, `.get()`, `.post()`, `.patch()`, `.put()`) returns a
 * Promise so `await` works.
 *
 * We can tell "terminal" from "chained" by the property name: HTTP verb
 * names (`get`/`post`/`put`/`patch`/`delete`) resolve to functions that
 * return Promises; everything else returns another proxy.
 */
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
      // Non-verb call (e.g. `admin.users({id})`) — return a chainable proxy
      // whose path includes a marker so subsequent property access keeps
      // walking. We append a `()` segment so the recorded path reads
      // naturally in test failures.
      return make([...path, '()']);
    };
    return new Proxy(target, {
      get: (_t, prop) => {
        if (prop === 'then') return undefined;
        return make([...path, String(prop)]);
      },
      // biome-ignore lint/complexity/useMaxParams: Proxy `apply` handler signature is fixed by the ECMAScript spec (target, thisArg, argsList) — we can't collapse it.
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

interface MockAgent extends AgentContext {
  elicitInput: ReturnType<typeof vi.fn>;
}

function makeAgent(elicit: { resolve?: ElicitInputResult; reject?: unknown }): {
  agent: MockAgent;
  server: McpServer;
  calls: ApiCall[];
  elicitSpy: ReturnType<typeof vi.fn>;
} {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const { api, calls } = makeApiStub();
  const elicitSpy = vi.fn();
  if (elicit.resolve !== undefined) elicitSpy.mockResolvedValue(elicit.resolve);
  else if (elicit.reject !== undefined) elicitSpy.mockRejectedValue(elicit.reject);
  else elicitSpy.mockResolvedValue({ action: 'cancel' });

  const agent: MockAgent = {
    server,
    api,
    apiBaseUrl: 'https://api.test',
    setFeatureFlag: () => {
      /* no-op */
    },
    registerFlaggedTool: (_flag, ...args) =>
      (server.registerTool as (...a: unknown[]) => ReturnType<typeof server.registerTool>)(...args),
    elicitInput: elicitSpy,
  };
  return { agent, server, calls, elicitSpy };
}

/** Result shape every tool handler returns. */
type ToolHandlerResult = {
  isError?: true;
  content: [{ type: 'text'; text: string }];
  structuredContent?: { error?: { code: string; message: string; retryable: boolean } };
};

type ToolHandler = (
  args: Record<string, unknown>,
  extra: { requestId: RequestId; signal: AbortSignal },
) => Promise<ToolHandlerResult>;

/**
 * Internal accessor for the SDK's registered-tools map + handler.
 *
 * The SDK 1.29 `RegisteredTool` shape calls the user callback `handler`
 * (renamed from `callback` in an earlier bump — see
 * `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts`). We
 * coerce loosely because the function is generic over arg shapes and
 * we're passing a Record-shaped payload that every U10-gated tool's Zod
 * schema can pick from.
 */
function getToolHandler(server: McpServer, name: string): ToolHandler {
  const internal = server as unknown as {
    _registeredTools: Record<string, { handler?: unknown; callback?: unknown }>;
  };
  const tool = internal._registeredTools[name];
  if (!tool) throw new Error(`tool not registered: ${name}`);
  // SDK 1.29 uses `handler`; older versions used `callback`. Accept either
  // so a future SDK bump that flips back doesn't silently no-op the tests.
  const fn = tool.handler ?? tool.callback;
  if (typeof fn !== 'function') {
    throw new Error(`tool ${name} has no handler/callback function`);
  }
  return fn as ToolHandler;
}

function makeExtra(): { requestId: RequestId; signal: AbortSignal } {
  return { requestId: 'test-req-1', signal: new AbortController().signal };
}

// ── packrat_admin_hard_delete_user ───────────────────────────────────────────

describe('packrat_admin_hard_delete_user (U10 elicitation)', () => {
  it('fires the DELETE call when the user types the matching user_id', async () => {
    const { agent, server, calls, elicitSpy } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'user-42' } },
    });
    registerAdminTools(agent);
    const tool = getToolHandler(server, 'packrat_admin_hard_delete_user');

    const result = await tool({ user_id: 'user-42', reason: 'GDPR request #1' }, makeExtra());

    // Elicitation fired with the agents@0.13 relatedRequestId option.
    expect(elicitSpy).toHaveBeenCalledTimes(1);
    expect(nth(nth(elicitSpy.mock.calls, 0), 1)).toEqual({ relatedRequestId: 'test-req-1' });

    // API DELETE chain executed: admin.users({id}).hard.delete({reason})
    expect(result.isError).toBeUndefined();
    const deletes = calls.filter((c) => c.path.at(-1) === 'delete');
    expect(deletes).toHaveLength(1);
    expect(nth(deletes, 0).args[0]).toEqual({ reason: 'GDPR request #1' });
  });

  it('does NOT fire the DELETE when the user types the wrong confirmation', async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'user-wrong' } },
    });
    registerAdminTools(agent);
    const tool = getToolHandler(server, 'packrat_admin_hard_delete_user');

    const result = await tool({ user_id: 'user-42', reason: 'GDPR request' }, makeExtra());

    expect(result.isError).toBe(true);
    expect(result.structuredContent?.error?.code).toBe('confirmation_mismatch');
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });

  it('does NOT fire the DELETE when the user cancels', async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'cancel' },
    });
    registerAdminTools(agent);
    const tool = getToolHandler(server, 'packrat_admin_hard_delete_user');

    const result = await tool({ user_id: 'user-42', reason: 'r' }, makeExtra());

    expect(result.isError).toBe(true);
    expect(result.structuredContent?.error?.code).toBe('user_cancelled');
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });

  it('does NOT fire the DELETE when the client does not support elicitations', async () => {
    const { agent, server, calls } = makeAgent({
      reject: new Error('Client does not support elicitation (required for elicitation/create)'),
    });
    registerAdminTools(agent);
    const tool = getToolHandler(server, 'packrat_admin_hard_delete_user');

    const result = await tool({ user_id: 'user-42', reason: 'r' }, makeExtra());

    expect(result.isError).toBe(true);
    expect(result.structuredContent?.error?.code).toBe('elicitation_unsupported');
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });
});

describe('admin analytics structured output', () => {
  it.each([
    'packrat_admin_analytics_growth',
    'packrat_admin_analytics_activity',
    'packrat_admin_analytics_pack_breakdown',
  ])('%s wraps upstream arrays in structuredContent.items', async (toolName) => {
    const { agent, server } = hMakeAgent();
    registerAdminTools(agent);
    const handler = hGetToolHandler(server, toolName);
    const result = await handler({}, hMakeExtra());
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ items: { success: true } });
    expect(hFirstText(result)).toContain('"items"');
  });
});

// ── packrat_admin_delete_pack ────────────────────────────────────────────────

describe('packrat_admin_delete_pack (U10 elicitation)', () => {
  it("fires the DELETE only after the user types 'DELETE'", async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'DELETE' } },
    });
    registerAdminTools(agent);
    const result = await getToolHandler(server, 'packrat_admin_delete_pack')(
      { pack_id: 'pack-7' },
      makeExtra(),
    );
    expect(result.isError).toBeUndefined();
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(1);
  });

  it("rejects on a mismatched confirmation (e.g. 'delete' lowercase)", async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'delete' } },
    });
    registerAdminTools(agent);
    const result = await getToolHandler(server, 'packrat_admin_delete_pack')(
      { pack_id: 'pack-7' },
      makeExtra(),
    );
    expect(result.structuredContent?.error?.code).toBe('confirmation_mismatch');
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });
});

// ── packrat_admin_delete_catalog_item ────────────────────────────────────────

describe('packrat_admin_delete_catalog_item (U10 elicitation)', () => {
  it("fires the DELETE only after the user types 'DELETE'", async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'DELETE' } },
    });
    registerAdminTools(agent);
    const result = await getToolHandler(server, 'packrat_admin_delete_catalog_item')(
      { item_id: 123 },
      makeExtra(),
    );
    expect(result.isError).toBeUndefined();
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(1);
  });
});

// ── packrat_admin_delete_trail_condition_report ──────────────────────────────

describe('packrat_admin_delete_trail_condition_report (U10 elicitation)', () => {
  it("fires the DELETE only after the user types 'DELETE'", async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'DELETE' } },
    });
    registerAdminTools(agent);
    const result = await getToolHandler(server, 'packrat_admin_delete_trail_condition_report')(
      { report_id: 'rep-1' },
      makeExtra(),
    );
    expect(result.isError).toBeUndefined();
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(1);
  });
});

// ── packrat_create_app_pack_template (PUBLISH) ───────────────────────────────

describe('packrat_create_app_pack_template (U10 elicitation)', () => {
  it("fires the POST only after the admin types 'PUBLISH'", async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'PUBLISH' } },
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated AT Thru-Hike', category: 'hiking' },
      makeExtra(),
    );
    expect(result.isError).toBeUndefined();
    expect(calls.filter((c) => c.path.at(-1) === 'post')).toHaveLength(1);
  });

  it('rejects on mismatched confirmation', async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'publish' } },
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'X', category: 'hiking' },
      makeExtra(),
    );
    expect(result.structuredContent?.error?.code).toBe('confirmation_mismatch');
    expect(calls.filter((c) => c.path.at(-1) === 'post')).toHaveLength(0);
  });

  it('returns elicitation_unsupported envelope when the client lacks elicitation', async () => {
    const { agent, server, calls } = makeAgent({
      reject: new Error('Client does not support elicitation (required for elicitation/create)'),
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'X', category: 'hiking' },
      makeExtra(),
    );
    expect(result.structuredContent?.error?.code).toBe('elicitation_unsupported');
    expect(calls.filter((c) => c.path.at(-1) === 'post')).toHaveLength(0);
  });
});

// ── packrat_generate_pack_template_from_url (GENERATE) ───────────────────────

describe('packrat_generate_pack_template_from_url (U10 elicitation)', () => {
  it("fires the POST only after the admin types 'GENERATE'", async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'GENERATE' } },
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_generate_pack_template_from_url')(
      { content_url: 'https://youtube.com/watch?v=abc', is_app_template: false },
      makeExtra(),
    );
    expect(result.isError).toBeUndefined();
    expect(calls.filter((c) => c.path.at(-1) === 'post')).toHaveLength(1);
  });

  it('returns user_cancelled envelope when the admin declines', async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'decline' },
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_generate_pack_template_from_url')(
      { content_url: 'https://youtube.com/watch?v=abc', is_app_template: false },
      makeExtra(),
    );
    expect(result.structuredContent?.error?.code).toBe('user_cancelled');
    expect(calls.filter((c) => c.path.at(-1) === 'post')).toHaveLength(0);
  });
});

// ── Catalog: enumerate U10-gated tools, ensure all carry the elicitation pattern ──

describe('U10 catalog — every documented tool gates on a confirmation', () => {
  const U10_GATED_TOOLS = [
    'packrat_admin_hard_delete_user',
    'packrat_admin_delete_pack',
    'packrat_admin_delete_catalog_item',
    'packrat_admin_delete_trail_condition_report',
    'packrat_create_app_pack_template',
    'packrat_generate_pack_template_from_url',
  ] as const;

  it.each(
    U10_GATED_TOOLS,
  )('%s: cancelled elicitation suppresses the downstream API call', async (name) => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'cancel' },
    });
    registerAdminTools(agent);
    registerPackTemplateTools(agent);
    const tool = getToolHandler(server, name);
    // Each tool has different required input shapes; pass a permissive
    // superset that satisfies every tool's schema. Extra fields are
    // ignored by the SDK because the registered Zod schema only picks
    // out what it declared.
    const result = await tool(
      {
        user_id: 'u',
        reason: 'r',
        pack_id: 'p',
        item_id: 'i',
        report_id: 'r',
        name: 'n',
        category: 'hiking',
        content_url: 'https://example.com',
        is_app_template: false,
      },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent?.error?.code).toBe('user_cancelled');
    expect(calls.filter((c) => ['delete', 'post'].includes(c.path.at(-1) ?? ''))).toHaveLength(0);
  });
});

// ── Elicitation-failure mapping: timeout + post-accept API failure ───────────
// These drive the `elicitFailureResponse`/`auditElicitDeclined` `timeout`
// arms and the `auditOutcome` failure-with-error branch. They use the shared
// `_tool-harness` makeAgent because it supports `reject` (→ timeout) and
// `apiFail` (→ 500 envelope) together with a per-call audit context.

const TIMEOUT_ERROR = new Error('Elicitation request timed out');

describe('admin elicitation timeout mapping', () => {
  it('packrat_admin_hard_delete_user → confirmation_timeout (retryable) when the prompt times out', async () => {
    const { agent, server, calls } = hMakeAgent({ reject: TIMEOUT_ERROR });
    registerAdminTools(agent);
    const result = await hGetToolHandler(server, 'packrat_admin_hard_delete_user')(
      { user_id: 'user-42', reason: 'GDPR' },
      hMakeExtra(),
    );
    expect(result.isError).toBe(true);
    expect((result.structuredContent?.error as { code: string }).code).toBe('confirmation_timeout');
    expect((result.structuredContent?.error as { retryable: boolean }).retryable).toBe(true);
    expect(hFirstText(result)).toContain('timed out');
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });

  it('packrat_admin_delete_pack → confirmation_timeout when the prompt times out', async () => {
    const { agent, server, calls } = hMakeAgent({ reject: TIMEOUT_ERROR });
    registerAdminTools(agent);
    const result = await hGetToolHandler(server, 'packrat_admin_delete_pack')(
      { pack_id: 'pack-7' },
      hMakeExtra(),
    );
    expect(result.isError).toBe(true);
    expect((result.structuredContent?.error as { code: string }).code).toBe('confirmation_timeout');
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });
});

describe('admin auditOutcome failure branch (accept then API 500)', () => {
  it('packrat_admin_delete_pack → api_error envelope after confirmation accepted', async () => {
    const { agent, server, calls } = hMakeAgent({
      resolve: { action: 'accept', content: { confirmation: 'DELETE' } },
      apiFail: true,
    });
    registerAdminTools(agent);
    const result = await hGetToolHandler(server, 'packrat_admin_delete_pack')(
      { pack_id: 'pack-7' },
      hMakeExtra(),
    );
    // Confirmation passed → the DELETE fired → the 500 envelope surfaced via
    // call(), exercising auditOutcome's `isError === true` + structured-error arm.
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(1);
    expect(result.isError).toBe(true);
    expect((result.structuredContent?.error as { code: string }).code).toBe('api_error');
  });

  it('packrat_admin_hard_delete_user → api_error envelope after confirmation accepted', async () => {
    const { agent, server, calls } = hMakeAgent({
      resolve: { action: 'accept', content: { confirmation: 'user-42' } },
      apiFail: true,
    });
    registerAdminTools(agent);
    const result = await hGetToolHandler(server, 'packrat_admin_hard_delete_user')(
      { user_id: 'user-42', reason: 'GDPR' },
      hMakeExtra(),
    );
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(1);
    expect(result.isError).toBe(true);
    expect((result.structuredContent?.error as { code: string }).code).toBe('api_error');
  });
});

describe('admin audit context — getAuditContext present branch', () => {
  it('uses the agent-provided audit context when getAuditContext is defined', async () => {
    const { agent, server, calls } = hMakeAgent({ resolve: { action: 'cancel' } });
    // Provide a real audit context so the `getAuditContext?.() ?? {}` nullish
    // fallback takes its left (defined) side.
    agent.getAuditContext = () => ({
      userId: 'admin-1',
      scopes: ['mcp:admin'] as const,
      correlationId: 'corr-1',
    });
    registerAdminTools(agent);
    const result = await hGetToolHandler(server, 'packrat_admin_delete_pack')(
      { pack_id: 'pack-7' },
      hMakeExtra(),
    );
    // Cancelled → user_cancelled envelope, no DELETE — but the audit line ran
    // with the provided actor (left side of the `??`).
    expect((result.structuredContent?.error as { code: string }).code).toBe('user_cancelled');
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });
});
