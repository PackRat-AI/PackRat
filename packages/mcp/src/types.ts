/**
 * Minimal agent interface expected by tool/resource/prompt registration functions.
 *
 * Using a structural interface rather than the concrete PackRatMCP class avoids
 * the circular dependency: index.ts → tools/* → index.ts.
 * PackRatMCP satisfies this interface structurally via its `server` and `api` fields.
 */

import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PackRatApiClient } from './client';

export interface AgentContext {
  server: McpServer;
  api: PackRatApiClient;
}

/** Cloudflare Worker environment bindings */
export interface Env {
  /** Durable Object binding for MCP sessions */
  PackRatMCP: DurableObjectNamespace;
  /** Base URL of the PackRat API (e.g. "https://packrat.world") */
  PACKRAT_API_URL: string;
  /** KV namespace for OAuth token storage (required by workers-oauth-provider) */
  OAUTH_KV: KVNamespace;
  /** OAuth helpers injected by OAuthProvider at runtime */
  OAUTH_PROVIDER: OAuthHelpers;
  /** Optional pre-shared secret for dynamic client registration */
  MCP_INITIAL_ACCESS_TOKEN?: string;
}

/** Properties embedded in OAuth access tokens and passed to API handlers */
export interface Props {
  /** Better Auth session token used to authenticate PackRat API calls */
  betterAuthToken: string;
  /** PackRat user ID */
  userId: string;
}
