/**
 * Minimal agent interface expected by tool/resource/prompt registration functions.
 *
 * Using a structural interface rather than the concrete PackRatMCP class avoids
 * the circular dependency: index.ts → tools/* → index.ts.
 * PackRatMCP satisfies this interface structurally via its `server`, `api`,
 * `apiBaseUrl`, and `setFeatureFlag` fields.
 *
 * U5 note: `setAdminToken` and `registerAdminTool` have been removed. Admin
 * gating now happens at OAuth-grant time via the `mcp:admin` scope — see
 * `packages/mcp/src/scopes.ts` and the per-session disable pass in
 * `PackRatMCP.init()`. Tool files register admin tools normally via
 * `agent.server.registerTool(...)`; the agent walks them after init() and
 * disables anything the granted scopes don't authorize.
 */

import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpClients } from './client';

/** Subset of McpServer.registerTool we use — same signature, no narrower types needed downstream. */
export type RegisterToolFn = McpServer['registerTool'];

/**
 * Wrap `server.registerTool` with a feature-flag gate. The first argument is
 * the flag name; the tool is only visible when that flag is enabled. Flag
 * names match `MCP_FEATURE_FLAGS` (comma-separated env binding) or the
 * runtime-toggled set passed to `setFeatureFlag`.
 */
export type RegisterFlaggedToolFn = <
  // The TS types here mirror McpServer['registerTool']; we accept any args after
  // the flag name and rely on the SDK to validate downstream.
  TArgs extends Parameters<RegisterToolFn>,
>(
  flag: string,
  ...args: TArgs
) => ReturnType<RegisterToolFn>;

export interface AgentContext {
  server: McpServer;
  /** Eden Treaty clients — `api.user` for the signed-in user, `api.admin` for admin ops. */
  api: McpClients;
  /** Base URL of the PackRat API (e.g. "https://packrat.world"). */
  apiBaseUrl: string;
  /** Toggle a feature flag at runtime (debug / admin-set). */
  setFeatureFlag: (flag: string, enabled: boolean) => void;
  /**
   * Register a tool gated on a named feature flag. The tool is hidden unless
   * the flag is present in `MCP_FEATURE_FLAGS` or has been toggled on at
   * runtime via `setFeatureFlag`.
   */
  registerFlaggedTool: RegisterFlaggedToolFn;
  /** Best-effort PackRat user ID (from OAuth props). May be empty for legacy bearer flows. */
  userId?: string;
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
  /**
   * Pre-shared secret for dynamic client registration. **Required as of U4**:
   * if unset, `POST /register` returns 401 to every caller (DCR effectively
   * disabled). Operators must set this via `wrangler secret put` before
   * pre-registering Claude's callbacks — see `docs/mcp/runbook.md`.
   *
   * Typed as optional because the binding is absent in test environments
   * and the `dcrRegisterGate` helper must handle the unset case
   * gracefully (fail-closed).
   */
  MCP_INITIAL_ACCESS_TOKEN?: string;
  /** Comma-separated feature flags enabled at boot (e.g. "wildlife_id,season_suggestions"). */
  MCP_FEATURE_FLAGS?: string;
}

/**
 * Properties embedded in OAuth access tokens and passed to API handlers.
 *
 * U5: `scopes` is the set of OAuth scopes granted to the token at
 * `/callback` time. The DO uses this to decide which tools to disable
 * for the session. There is no longer a parallel `adminToken` field —
 * admin tools are gated by the presence of `mcp:admin` in `scopes`.
 */
export interface Props {
  /** Better Auth session token used to authenticate PackRat API calls */
  betterAuthToken: string;
  /** PackRat user ID */
  userId: string;
  /** OAuth scopes granted to this session (e.g. `['mcp:read', 'mcp:write']`). */
  scopes: readonly string[];
}
