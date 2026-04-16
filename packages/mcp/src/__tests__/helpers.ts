/**
 * Test helpers — create lightweight fakes for McpServer and PackRatApiClient.
 *
 * Tool handlers are extracted from the `registerTool` calls so they can be
 * invoked directly in tests without spinning up a Durable Object or MCP session.
 */
import { vi } from 'vitest';
import type { PackRatApiClient } from '../client';
import type { PackRatMCP } from '../index';

/** Captured tool registration. */
export interface RegisteredTool {
  name: string;
  config: { description?: string; inputSchema: Record<string, unknown> };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Captured resource registration. */
export interface RegisteredResource {
  name: string;
}

/** Captured prompt registration. */
export interface RegisteredPrompt {
  name: string;
}

/**
 * Build a fake McpServer that records `registerTool` calls.
 * Returns the registry map so tests can pull out and invoke handlers directly.
 */
export function buildMockServer() {
  const tools = new Map<string, RegisteredTool>();
  const resources = new Map<string, RegisteredResource>();
  const prompts = new Map<string, RegisteredPrompt>();

  const server = {
    registerTool: vi.fn(
      (name: string, config: RegisteredTool['config'], handler: RegisteredTool['handler']) => {
        tools.set(name, { name, config, handler });
      },
    ),
    registerResource: vi.fn(
      (name: string, _uriOrTemplate: unknown, _config: unknown, _handler: unknown) => {
        resources.set(name, { name });
      },
    ),
    registerPrompt: vi.fn((name: string, _config: unknown, _handler: unknown) => {
      prompts.set(name, { name });
    }),
  };

  return { server, tools, resources, prompts };
}

/**
 * Build a mock PackRatApiClient where every method is a vi.fn().
 */
export function buildMockApiClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  } as unknown as PackRatApiClient;
}

/**
 * Build a minimal fake PackRatMCP agent with mocked server and api.
 */
export function buildMockAgent(): {
  agent: PackRatMCP;
  tools: Map<string, RegisteredTool>;
  resources: Map<string, RegisteredResource>;
  prompts: Map<string, RegisteredPrompt>;
  api: PackRatApiClient;
} {
  const { server, tools, resources, prompts } = buildMockServer();
  const api = buildMockApiClient();

  const agent = {
    server,
    api,
    state: { authToken: 'test-token' },
    env: { PACKRAT_API_URL: 'https://api.example.com', PackRatMCP: {} },
  } as unknown as PackRatMCP;

  return { agent, tools, resources, prompts, api };
}

/** Invoke a registered tool by name, returning its result. */
export async function callTool(
  tools: Map<string, RegisteredTool>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool "${name}" not registered`);
  return tool.handler(args) as Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

/** Parse the JSON text from a tool result's first content block. */
export function parseToolResult(result: {
  content: Array<{ type: string; text: string }>;
}): unknown {
  return JSON.parse(result.content[0].text);
}
