/**
 * PackRat MCP Server
 *
 * A full-featured Model Context Protocol server for outdoor adventure planning,
 * built on Cloudflare Workers + Durable Objects using the Cloudflare Agents SDK.
 *
 * The MCP server is intentionally a *lean* layer on top of the PackRat API.
 * All business logic lives in the API (`@packrat/api`); this package just
 * surfaces typed tool wrappers via Eden Treaty, plus per-session auth state.
 *
 * Features:
 *  - 60+ tools across user + admin surfaces — packs, gear catalog, trips,
 *    weather, trail conditions, outdoor knowledge, feed, pack templates,
 *    season suggestions, wildlife, alltrails, uploads, guides, AI, admin.
 *  - End-to-end typed Eden Treaty calls to the PackRat API.
 *  - MCP resources: pack/trip/gear data accessible by URI.
 *  - Guided prompts: trip planning, pack optimization, gear recommendations.
 *  - Stateful sessions with hibernation (via Durable Objects).
 *  - Pure protected resource: JWT access tokens are minted by the API worker
 *    (`api.packrat.world`) via `@better-auth/oauth-provider`. This worker
 *    verifies tokens locally against the JWKS — no AS state machine here.
 *  - Scope-based admin gating (U5): admin tools are visible only when the
 *    JWT carries the `mcp:admin` scope claim.
 *
 * Transport: Streamable HTTP (default) and SSE.
 *
 * Surface map:
 *   GET  /.well-known/oauth-protected-resource  → RFC 9728 metadata (CORS-open
 *                                                  for Claude origins).
 *   GET  /health                                 → upstream API health probe,
 *                                                  10s isolate-local cache.
 *   GET  /status                                 → static metadata (version,
 *                                                  scopes, commit SHA).
 *   GET  /favicon.ico                            → embedded favicon for
 *                                                  Anthropic's domain-ownership
 *                                                  probe.
 *   *    /mcp[/...]                              → JWT-gated; delegated to the
 *                                                  PackRatMCP Durable Object.
 *   *    *                                       → 404.
 */

import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isFunction } from '@packrat/guards';
import { McpAgent } from 'agents/mcp';
import { handleHealth, handleStatus } from './auth';
import { createMcpClients, errResponse, type McpClients, type McpToolResult } from './client';
import { ServiceMeta } from './constants';
import { applyCorsHeaders } from './cors';
import { faviconResponse } from './favicon';
import { buildResourceMetadata, unauthorizedResponse } from './metadata';
import { attachCorrelationId, correlationIdFrom } from './observability';
import { registerPrompts } from './prompts';
import { checkRateLimit, toolRateLimitKey } from './rate-limit';
import { registerResources } from './resources';
import { getVisibleTools } from './scopes';
import { verifyMcpToken } from './token-verify';
import { registerAdminTools } from './tools/admin';
import { registerAiTools } from './tools/ai';
import { registerAlltrailsTools } from './tools/alltrails';
import { registerAuthTools } from './tools/auth';
import { registerCatalogTools } from './tools/catalog';
import { registerFeedTools } from './tools/feed';
import { registerGuidesTools } from './tools/guides';
import { registerKnowledgeTools } from './tools/knowledge';
import { registerPackTools } from './tools/packs';
import { registerPackTemplateTools } from './tools/packTemplates';
import { registerSeasonTools } from './tools/seasons';
import { registerTrailConditionTools } from './tools/trail-conditions';
import { registerTrailTools } from './tools/trails';
import { registerTripTools } from './tools/trips';
import { registerUploadTools } from './tools/upload';
import { registerUserTools } from './tools/user';
import { registerWeatherTools } from './tools/weather';
import { registerWildlifeTools } from './tools/wildlife';
import type { AgentContext, Env, Props } from './types';

export type { Env };

// ── Session state ─────────────────────────────────────────────────────────────

export interface State {
  /** JWT access token from the verified Authorization header, forwarded to the
   *  PackRat API for proxied tool calls. */
  authToken: string;
}

// ── MCP Agent (Durable Object) ────────────────────────────────────────────────

export class PackRatMCP extends McpAgent<Env, State, Props> {
  server = new McpServer({
    name: ServiceMeta.McpServerName,
    version: ServiceMeta.Version,
  });

  initialState: State = { authToken: '' };

  private _api: McpClients | null = null;
  private _flaggedTools: Map<string, RegisteredTool[]> = new Map();
  private _flagState: Map<string, boolean> = new Map();
  /**
   * Map of tool name → registered handle, populated during `init()` by a
   * proxy on `server.registerTool`. The post-init scope-filter pass walks
   * this map and disables anything the granted scopes don't authorize.
   * Using a local map (rather than reaching into the SDK's private
   * `_registeredTools`) keeps us off of internal SDK shape.
   */
  private _toolsByName: Map<string, RegisteredTool> = new Map();

  get api(): McpClients {
    if (!this._api) {
      this._api = createMcpClients({
        baseUrl: this.apiBaseUrl,
        getUserToken: () => this.state.authToken,
      });
    }
    return this._api;
  }

  get apiBaseUrl(): string {
    return this.env.PACKRAT_API_URL;
  }

  /**
   * Register a tool gated on a feature flag. The tool is hidden unless the
   * flag is present in `MCP_FEATURE_FLAGS` or enabled via `setFeatureFlag`.
   */
  registerFlaggedTool: AgentContext['registerFlaggedTool'] = ({ flag, args }) => {
    // safe-cast: McpServer.registerTool's overloads collapse at the implementation level;
    // forwarding via spread requires a single call signature here.
    const tool = (this.server.registerTool as (...a: unknown[]) => RegisteredTool)(
      ...(args as unknown[]),
    );
    const bucket = this._flaggedTools.get(flag) ?? [];
    bucket.push(tool);
    this._flaggedTools.set(flag, bucket);
    if (!this.isFlagEnabled(flag)) tool.disable();
    return tool;
  };

  setFeatureFlag({ flag, enabled }: { flag: string; enabled: boolean }): void {
    this._flagState.set(flag, enabled);
    for (const tool of this._flaggedTools.get(flag) ?? []) {
      if (enabled && !tool.enabled) tool.enable();
      else if (!enabled && tool.enabled) tool.disable();
    }
  }

  private isFlagEnabled(flag: string): boolean {
    const runtime = this._flagState.get(flag);
    if (runtime !== undefined) return runtime;
    const envList = (this.env.MCP_FEATURE_FLAGS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return envList.includes(flag);
  }

  /**
   * Override `server.registerTool` to:
   *
   *   1. Record each registration in `_toolsByName` so the post-init
   *      scope-filter pass can walk every tool.
   *   2. Wrap the tool handler in a U14 rate-limit gate keyed by
   *      `${props.userId}:${toolName}` per the connector-readiness plan's
   *      rate-limit-split decision. Per-user/per-tool counters are
   *      independent so one user spamming `packrat_get_pack` doesn't
   *      starve their own `packrat_list_trips` budget, and two users
   *      hitting the same tool don't share a counter.
   *
   * The wrapper is installed once at the top of `init()` and tears down
   * nothing — every tool file calls `agent.server.registerTool(...)` and
   * lands in the map transparently. The rate-limit budget itself
   * (60/60s) is configured at the binding level in `wrangler.jsonc`, not
   * here, so operators can tune it without a code change.
   */
  private installToolRegistrationProxy(): void {
    const original = this.server.registerTool.bind(this.server);
    // safe-cast: McpServer.registerTool's overload union collapses at the
    // implementation level — forwarding via spread requires a single
    // call signature here.
    this.server.registerTool = ((...args: unknown[]) => {
      const name = args[0] as string;
      // The SDK's `registerTool(name, config, cb)` signature puts the
      // handler at index 2. The config-less `(name, cb)` form was removed
      // for the modern `registerTool` (only the deprecated `tool()` shape
      // accepts it), so we can rely on index 2 here.
      const originalHandler = args[2] as ((...handlerArgs: unknown[]) => unknown) | undefined;
      if (isFunction(originalHandler)) {
        const wrappedHandler = this.wrapHandlerWithRateLimit({
          toolName: name,
          handler: originalHandler,
        });
        args[2] = wrappedHandler;
      }
      const tool = (original as (...a: unknown[]) => RegisteredTool)(...args);
      this._toolsByName.set(name, tool);
      return tool;
    }) as typeof this.server.registerTool;
  }

  /**
   * Wrap a tool's handler so each invocation passes through
   * `env.MCP_TOOLS_RL.limit({ key })` before the original handler runs.
   *
   * Key shape per the connector-readiness plan's K.T.D.:
   * `${props.userId}:${toolName}`. `props.userId` is set at JWT-verify
   * time in the outer fetch wrapper (from the `sub` claim); if absent
   * (e.g. a malformed token slipped past verification — shouldn't happen,
   * but defensive) the key collapses to `:${toolName}`.
   *
   * On exceed: returns the canonical U8 `errResponse('rate_limited', ...,
   * true)` envelope so the model gets a structured signal it can back
   * off and retry against. The wrapper does NOT alter `arguments` /
   * `extra` shape — the SDK validates the rest of the request boundary.
   */
  private wrapHandlerWithRateLimit({
    toolName,
    handler,
  }: {
    toolName: string;
    handler: (...handlerArgs: unknown[]) => unknown;
  }): (...handlerArgs: unknown[]) => unknown {
    return async (...handlerArgs: unknown[]): Promise<unknown> => {
      const userId = this.currentUserId();
      const key = toolRateLimitKey(userId, toolName);
      const allowed = await checkRateLimit(this.env, key);
      if (!allowed) {
        const rateLimited: McpToolResult = errResponse(
          'rate_limited',
          'Rate limit exceeded; try again in a moment.',
          true,
        );
        return rateLimited;
      }
      return handler(...handlerArgs);
    };
  }

  /**
   * Best-effort lookup of the current user ID from `this.props` (sourced
   * from the verified JWT's `sub` claim in the outer fetch wrapper). If
   * `props` is missing or malformed, returns `''` and the rate-limit key
   * collapses to `:${toolName}` — see `wrapHandlerWithRateLimit` for the
   * trade-off.
   */
  private currentUserId(): string {
    const props = this.props as { userId?: string } | undefined;
    return props?.userId ?? '';
  }

  /**
   * U15: per-session audit context surfaced to admin tool handlers via
   * `AgentContext.getAuditContext()`.
   *
   * Returns `{ userId, scopes, correlationId }` where:
   *
   *   - `userId` and `scopes` are read straight off `this.props`
   *     (set from the verified JWT's `sub` and `scope` claims in the
   *     outer fetch wrapper). If `props` is missing, both collapse to
   *     empty values — the audit line still emits, just without actor
   *     attribution. That's deliberate: we'd rather record "someone
   *     unauthenticated triggered this" than silently drop the audit.
   *
   *   - `correlationId` is a session-stable `session:<DO-id>` synthetic.
   *     Per-tool-call IDs would need the inbound Request to pivot on,
   *     and the SDK doesn't surface that through `RequestHandlerExtra`.
   *     `session:<DO-id>` is the right granularity for "which session
   *     fired this audit" — every audit line on the same session shares
   *     a key an operator can filter on.
   */
  getAuditContext(): { userId: string; scopes: readonly string[]; correlationId: string } {
    const props = this.props as { userId?: string; scopes?: readonly string[] } | undefined;
    return {
      userId: props?.userId ?? '',
      scopes: props?.scopes ?? [],
      correlationId: `session:${this.ctx.id.toString()}`,
    };
  }

  /**
   * After registration, disable every tool whose visible-scopes don't
   * intersect the granted scopes. Uses the SDK's `RegisteredTool.disable()`
   * which auto-emits `notifications/tools/list_changed`.
   *
   * `props.scopes` is set from the verified JWT's `scope` claim in the
   * outer fetch wrapper. If absent (e.g. a token without a `scope` claim
   * or one that failed parsing), we fall back to the `['mcp']` umbrella
   * scope per the back-compat contract documented in `scopes.ts` — that
   * scope only authorizes reads, so the worst-case misclassification is
   * "an admin token loses access to admin tools until they re-auth".
   */
  private applyScopeFilter(grantedScopes: readonly string[]): void {
    const isVisible = getVisibleTools(grantedScopes);
    for (const [name, tool] of this._toolsByName) {
      if (!isVisible(name) && tool.enabled) {
        tool.disable();
      }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const userToken = authHeader?.match(BEARER_REGEX)?.[1] ?? '';

    if (userToken && userToken !== this.state.authToken) {
      this.setState({ ...this.state, authToken: userToken });
    }

    return super.fetch(request);
  }

  async init(): Promise<void> {
    // Install the registration proxy BEFORE any tool register call so
    // every tool lands in `_toolsByName`. The scope-filter pass below
    // relies on this map being complete.
    this.installToolRegistrationProxy();

    // ── User-level (Bearer) ────────────────────────────────────────────────
    registerAuthTools(this);
    registerUserTools(this);
    registerPackTools(this);
    registerPackTemplateTools(this);
    registerCatalogTools(this);
    registerTripTools(this);
    registerWeatherTools(this);
    registerKnowledgeTools(this);
    registerTrailConditionTools(this);
    registerTrailTools(this);
    registerFeedTools(this);
    registerSeasonTools(this);
    registerWildlifeTools(this);
    registerAlltrailsTools(this);
    registerUploadTools(this);
    registerGuidesTools(this);
    registerAiTools(this);

    // ── Admin ──────────────────────────────────────────────────────────────
    // Admin tools register as ordinary tools; visibility is decided by the
    // post-init scope filter below. The session's granted scopes live in
    // `(this.props as { scopes?: readonly string[] }).scopes` — set in the
    // outer fetch wrapper from the verified JWT's `scope` claim.
    registerAdminTools(this);

    // ── Resources + prompts ────────────────────────────────────────────────
    registerResources(this);
    registerPrompts(this);

    // ── Scope-based visibility filter (U5) ─────────────────────────────────
    // `this.props` is injected by the outer fetch wrapper via `ctx.props`
    // before the DO fetch hits us (read by the `agents/mcp` SDK's `serve()`
    // implementation — see `node_modules/agents/dist/mcp/index.js`'s
    // `getAgentByName(..., { props: ctx.props })`). Missing scopes fall
    // back to the umbrella `['mcp']` per the back-compat contract.
    const props = this.props as { scopes?: readonly string[] } | undefined;
    const grantedScopes: readonly string[] =
      props?.scopes && props.scopes.length > 0 ? props.scopes : ['mcp'];
    this.applyScopeFilter(grantedScopes);
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BEARER_REGEX = /^Bearer\s+(\S+)/i;
/** Bound the Authorization header we even bother to inspect — Workers caps
 *  this around 8 KiB but 4 KiB is plenty for any JWT we expect. */
const MAX_BEARER_HEADER_LEN = 4096;

const mcpDoHandler = PackRatMCP.serve('/mcp');

/**
 * Extract the bearer token from an `Authorization` header value.
 *
 * Returns `null` if the header is missing, doesn't use the Bearer scheme,
 * the token slot is empty, or the value exceeds `MAX_BEARER_HEADER_LEN`.
 * Length-cap defense is symmetric with the deleted DCR gate helper —
 * neither verifier nor outer wrapper should pay JWKS-fetch cost on a
 * pathological header.
 */
function extractBearer(headerValue: string | null): string | null {
  if (!headerValue) return null;
  if (headerValue.length > MAX_BEARER_HEADER_LEN) return null;
  const match = BEARER_REGEX.exec(headerValue);
  if (!match) return null;
  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Annotate an outbound response with `X-Correlation-Id: <id>`.
 *
 * Returns a new Response wrapping the same body — Response headers are
 * immutable once the response is consumed, so we always clone via the
 * `new Response(body, init)` shape. The body is streamed through
 * unchanged (no buffering).
 */
function withCorrelationHeader({
  response,
  correlationId,
}: {
  response: Response;
  correlationId: string;
}): Response {
  if (response.headers.has('X-Correlation-Id')) return response;
  const annotated = new Response(response.body, response);
  annotated.headers.set('X-Correlation-Id', correlationId);
  return annotated;
}

/**
 * Worker entrypoint (U3+U4 cutover).
 *
 * The MCP worker is a **pure protected resource** after this refactor:
 * there is no OAuth state machine here, no authorize/callback/token/register
 * endpoints, no KV state, no scheduled handler. Token issuance + DCR + consent
 * all live in the API worker (`api.packrat.world`) via
 * `@better-auth/oauth-provider`. This worker:
 *
 *   1. Serves `/.well-known/oauth-protected-resource` (RFC 9728).
 *   2. Validates JWT access tokens locally against the API worker's JWKS
 *      (`verifyMcpToken` — U2).
 *   3. Delegates `/mcp` to the Durable Object, injecting the verified
 *      claims via `ctx.props`.
 *   4. Serves the operational surface — `/health`, `/status`, `/favicon.ico`.
 *
 * Props-injection mechanism (the load-bearing SDK-contract piece):
 *   The `agents/mcp` SDK's `McpAgent.serve('/mcp')` returns a handler that
 *   reads `ctx.props` and forwards them to the DO via
 *   `getAgentByName(ns, name, { props: ctx.props })` (see
 *   `node_modules/agents/dist/mcp/index.js` around line 134). To inject
 *   props we mutate `ctx` in place with `(ctx as any).props = { ... }`
 *   before calling `mcpDoHandler.fetch`. This matches option (a) in the
 *   plan's discussion of injection mechanisms — direct ctx mutation —
 *   because the SDK has no public `getProps` hook and `Object.assign`-style
 *   wrappers around `ExecutionContext` would lose the runtime's prototype
 *   methods (`waitUntil`, `passThroughOnException`).
 *
 * Audience-mismatch deferred decision (plan's D5):
 *   `props.betterAuthToken` forwards the MCP JWT as-is to the PackRat API
 *   for proxied calls. The JWT's `aud` is `https://mcp.packratai.com/mcp`,
 *   NOT `api.packrat.world`, so the API's `bearer()` plugin may reject
 *   it. The fix (when surfaced during U7+ runtime testing) is to extend
 *   `validAudiences` in `packages/api/src/auth/index.ts:oauthProvider({
 *   validAudiences: [...both URLs...] })` — option (a) per the plan.
 *   For now the token forwards unchanged; if proxied calls 401 in U6/U7,
 *   that's the one-line fix.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // U15: derive a correlation ID at the top of the wrapper and stash it
    // on the Request via a WeakMap so deep handlers can read it back
    // without plumbing it through every function signature. We also echo
    // it on every outbound response via `X-Correlation-Id` so operators
    // can trace a single request through Workers Logs + the upstream
    // Cloudflare zone log + Sentry by one value.
    const correlationId = correlationIdFrom(request);
    attachCorrelationId(request, correlationId);

    const url = new URL(request.url);

    // ── 1. CORS preflight short-circuit for Claude origins ───────────────────
    // OPTIONS preflights from allowlisted origins on `/.well-known/*` get a
    // 204 directly here so we never touch the dispatcher logic below.
    if (request.method === 'OPTIONS') {
      const cors = applyCorsHeaders({ request, existing: null });
      if (cors) return withCorrelationHeader({ response: cors, correlationId });
    }

    // ── 2. Public metadata + ops endpoints (no auth required) ────────────────
    if (url.pathname === '/.well-known/oauth-protected-resource') {
      const body = buildResourceMetadata(env);
      const res = Response.json(body);
      const annotated = applyCorsHeaders({ request, existing: res }) ?? res;
      return withCorrelationHeader({ response: annotated, correlationId });
    }
    if (url.pathname === '/health' || url.pathname === '/') {
      return withCorrelationHeader({ response: await handleHealth(request, env), correlationId });
    }
    if (url.pathname === '/status') {
      return withCorrelationHeader({ response: handleStatus(request, env), correlationId });
    }
    if (url.pathname === '/favicon.ico') {
      return withCorrelationHeader({ response: faviconResponse(), correlationId });
    }

    // ── 3. /mcp — JWT-gated protected resource ───────────────────────────────
    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
      const bearer = extractBearer(request.headers.get('Authorization'));
      if (!bearer) {
        return withCorrelationHeader({ response: unauthorizedResponse(env), correlationId });
      }

      const verified = await verifyMcpToken(bearer, { env, ctx });
      if (!verified) {
        return withCorrelationHeader({ response: unauthorizedResponse(env), correlationId });
      }

      // Inject the verified-claim Props into ctx.props for the DO handler.
      // The `agents/mcp` SDK reads `ctx.props` and forwards via
      // `getAgentByName(..., { props: ctx.props })` (see SDK source). The
      // Props shape is unchanged from the pre-cutover surface so the DO's
      // `init()` scope-filter and `getAuditContext()` read the same fields
      // without modification.
      const props: Props = {
        betterAuthToken: verified.token,
        userId: verified.sub,
        scopes: verified.scopes,
      };
      // safe-cast: ExecutionContext has no index signature for `props`, but
      // the SDK reads it via a dynamic property access — this is the
      // documented injection mechanism mirroring how OAuthProvider's
      // apiHandler used to populate it.
      (ctx as unknown as { props: Props }).props = props;

      const response = await mcpDoHandler.fetch(request, env, ctx);
      return withCorrelationHeader({ response, correlationId });
    }

    // ── 4. Anything else: 404 ────────────────────────────────────────────────
    return withCorrelationHeader({
      response: Response.json({ error: 'Not Found' }, { status: 404 }),
      correlationId,
    });
  },
};
