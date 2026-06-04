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
 *
 * U3+U4 (Better Auth OAuth consolidation): The MCP worker no longer hosts
 * an OAuth Authorization Server. JWT access tokens are minted by the API
 * worker (`api.packrat.world`) via `@better-auth/oauth-provider`; this
 * worker verifies them locally against the JWKS and delegates to the DO.
 * `OAUTH_KV`, `OAUTH_PROVIDER`, and `MCP_INITIAL_ACCESS_TOKEN` are gone.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpClients } from './client';
import type { ElicitCapable } from './elicit';

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
>(args: {
  flag: string;
  args: TArgs;
}) => ReturnType<RegisterToolFn>;

export interface AgentContext {
  server: McpServer;
  /** Eden Treaty clients — `api.user` for the signed-in user, `api.admin` for admin ops. */
  api: McpClients;
  /** Base URL of the PackRat API (e.g. "https://packrat.world"). */
  apiBaseUrl: string;
  /** Toggle a feature flag at runtime (debug / admin-set). */
  setFeatureFlag: (args: { flag: string; enabled: boolean }) => void;
  /**
   * Register a tool gated on a named feature flag. The tool is hidden unless
   * the flag is present in `MCP_FEATURE_FLAGS` or has been toggled on at
   * runtime via `setFeatureFlag`.
   */
  registerFlaggedTool: RegisterFlaggedToolFn;
  /** Best-effort PackRat user ID (from JWT `sub` claim, surfaced via Props). */
  userId?: string;
  /**
   * U10: MCP elicitation surface. Present on the live `PackRatMCP` agent
   * (which extends `McpAgent` and inherits `elicitInput` from agents@0.13);
   * optional here so unit tests can construct an `AgentContext` without
   * standing up the full Durable Object. Tools that need to prompt the
   * user for confirmation must call into the `elicit.ts` helpers
   * (`confirmAction`, `chooseFromList`), which gracefully degrade to a
   * `reason: 'unsupported'` failure when this field is undefined.
   */
  elicitInput?: ElicitCapable['elicitInput'];
  /**
   * U15: per-invocation audit context — used by admin tools to record
   * who performed an action and which scopes the OAuth grant carried.
   *
   * Returns the current OAuth-grant actor info (`userId`, `scopes`) and
   * a session-level correlation ID. The actor info is read from
   * `this.props` on `PackRatMCP`; the correlation ID is the synthetic
   * `session:<DO-id>` shape because a single DO instance can serve
   * many MCP requests over its lifetime and we lack a per-tool-call
   * inbound Request to pivot on.
   *
   * Optional so test stubs / non-DO contexts don't have to implement it;
   * tools that audit MUST fall back to an empty actor when this is
   * absent (the `audit` helper handles that cleanly — see `audit` in
   * `observability.ts`).
   */
  getAuditContext?: () => { userId: string; scopes: readonly string[]; correlationId: string };
}

/**
 * Shape of Cloudflare's `version_metadata` binding (declared in
 * wrangler.jsonc). The runtime injects the live deploy's identifiers.
 */
export interface WorkerVersionMetadata {
  id: string;
  tag: string;
  timestamp: string;
}

/** Cloudflare Worker environment bindings */
export interface Env {
  /** Durable Object binding for MCP sessions */
  PackRatMCP: DurableObjectNamespace;
  /** Base URL of the PackRat API (e.g. "https://packrat.world") */
  PACKRAT_API_URL: string;
  /** Comma-separated feature flags enabled at boot (e.g. "wildlife_id,season_suggestions"). */
  MCP_FEATURE_FLAGS?: string;
  /**
   * Workers Rate Limiting binding (U14). Configured under the
   * `rate_limiting` block in `packages/mcp/wrangler.jsonc` with a 60/60s
   * budget. Keyed `${props.userId}:${toolName}` per-call so per-user/
   * per-tool counters are independent; surfaces a `rate_limited`
   * `errResponse` envelope to the model when exceeded.
   *
   * Optional in the type because the binding is absent in unit tests and
   * may not be bound in some `wrangler dev` flows. The call site falls
   * back to "allowed" when the binding is undefined — dev should never
   * break because of a missing rate-limit binding.
   */
  MCP_TOOLS_RL?: RateLimit;
  /**
   * Cloudflare `version_metadata` binding (declared in wrangler.jsonc). The
   * runtime injects the current deploy's `{ id, tag, timestamp }` — no
   * deploy-time `--var` and no CI step required, so it behaves identically
   * under `wrangler deploy` and Cloudflare Workers Builds.
   *
   * `/status` surfaces `id` as `deployId` so a reviewer can correlate the
   * running Worker with a specific Cloudflare version (which Workers Builds
   * maps back to a git commit in its UI). Optional — absent under `wrangler
   * dev` / vitest, where `/status` returns the sentinel `'unknown'`.
   * **Never a secret** — it's a public deploy identifier on the same surface
   * as the package version.
   */
  CF_VERSION_METADATA?: WorkerVersionMetadata;
}

/**
 * Properties forwarded from the outer fetch wrapper to the MCP Durable Object
 * via `ctx.props` (read by the `agents/mcp` SDK in `serve()`).
 *
 * U5: `scopes` is the set of OAuth scopes granted to the token at
 * issuance time. The DO uses this to decide which tools to disable
 * for the session. Admin tools are gated by the presence of
 * `mcp:admin` in `scopes`.
 *
 * U3+U4: After the cutover, the shape is sourced from the verified JWT
 * (`sub` → `userId`, `scope` claim → `scopes`, raw JWT →
 * `betterAuthToken`). The DO's `init()` reads `this.props?.scopes`
 * unchanged.
 */
// `type` (not `interface`) so the shape carries an implicit string index
// signature and satisfies the `McpAgent<Env, State, Props>` constraint
// (`Props extends Record<string, unknown>`) — interfaces are not assignable
// to `Record<string, unknown>` without an explicit index signature.
export type Props = {
  /** JWT access token issued by the API worker; forwarded as a Bearer credential
   *  for proxied PackRat API calls. */
  betterAuthToken: string;
  /** PackRat user ID (JWT `sub` claim). */
  userId: string;
  /** OAuth scopes granted to this session (e.g. `['mcp:read', 'mcp:write']`). */
  scopes: readonly string[];
};
