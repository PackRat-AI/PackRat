/**
 * Shared test harness for exercising MCP tool handlers without a transport.
 *
 * Builds a real `McpServer` (registration is a pure call; transport is only
 * needed for `connect()`) plus a stub `AgentContext` whose `api` is a Proxy
 * that records the Treaty property chain + final-call args and resolves every
 * HTTP verb to a success-shaped Treaty result. Tool handlers can then be
 * invoked directly and asserted against `calls`.
 *
 * Extracted from tools-admin.test.ts so every `tools-*.test.ts` shares one
 * api-stub/agent/handler-accessor implementation.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { isFunction } from '@packrat/guards';
import { vi } from 'vitest';
import type { ElicitInputResult } from '../elicit';
import type { AgentContext } from '../types';

/** Call record entry — every property access chain + final invocation args. */
export type ApiCall = { path: string[]; args: unknown[] };

const HTTP_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/**
 * Build an api proxy that records the property chain and final-call args.
 *
 * `fail: true` makes every HTTP verb resolve to a Treaty *error* envelope
 * (`{ data: null, error, status: 500 }`) so the handler's error branch runs
 * and returns an `isError` result — used to cover the `call()` failure path.
 */
export function makeApiStub(opts: { fail?: boolean } = {}): {
  api: AgentContext['api'];
  calls: ApiCall[];
} {
  const calls: ApiCall[] = [];
  const verbResult = () =>
    opts.fail
      ? Promise.resolve({
          data: null,
          error: { status: 500, value: { message: 'simulated upstream failure' } },
          status: 500,
        })
      : Promise.resolve({ data: { success: true }, error: null, status: 200 });
  const make = (path: string[]): unknown => {
    const target = (...args: unknown[]) => {
      const last = path.at(-1) ?? '';
      calls.push({ path, args });
      if (HTTP_VERBS.has(last)) return verbResult();
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
        if (HTTP_VERBS.has(last)) return verbResult();
        return make([...path, '()']);
      },
    });
  };
  return { api: make([]) as AgentContext['api'], calls };
}

export interface MockAgent extends AgentContext {
  elicitInput: ReturnType<typeof vi.fn>;
}

/**
 * Build a stub agent + fresh server. `elicit` controls the `elicitInput`
 * spy: `resolve` makes it return that result, `reject` makes it throw,
 * default resolves `{ action: 'cancel' }` (the U10 declined path).
 */
export function makeAgent(
  elicit: { resolve?: ElicitInputResult; reject?: unknown; apiFail?: boolean } = {},
): {
  agent: MockAgent;
  server: McpServer;
  calls: ApiCall[];
  elicitSpy: ReturnType<typeof vi.fn>;
} {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const { api, calls } = makeApiStub({ fail: elicit.apiFail });
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
export type ToolHandlerResult = {
  isError?: true;
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
};

export type ToolHandler = (
  args: Record<string, unknown>,
  extra: { requestId: RequestId; signal: AbortSignal },
) => Promise<ToolHandlerResult>;

/** Pull a registered tool's handler from the SDK's internal map. */
export function getToolHandler(server: McpServer, name: string): ToolHandler {
  const internal = server as unknown as {
    _registeredTools: Record<string, { handler?: unknown; callback?: unknown }>;
  };
  const tool = internal._registeredTools[name];
  if (!tool) throw new Error(`tool not registered: ${name}`);
  const fn = tool.handler ?? tool.callback;
  if (!isFunction(fn)) {
    throw new Error(`tool ${name} has no handler/callback function`);
  }
  return fn as ToolHandler;
}

export function makeExtra(): { requestId: RequestId; signal: AbortSignal } {
  return { requestId: 'test-req-1', signal: new AbortController().signal };
}

/** The text of the first content block — handy for assertions. */
export function firstText(result: ToolHandlerResult): string {
  return result.content[0]?.text ?? '';
}
