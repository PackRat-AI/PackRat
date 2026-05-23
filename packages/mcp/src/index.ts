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
 *  - OAuth 2.1 + PKCE authorization via @cloudflare/workers-oauth-provider.
 *  - Scope-based admin gating (U5): admin tools are visible only when the
 *    OAuth token carries the `mcp:admin` scope, which is granted at
 *    `/callback` time when the Better Auth user role resolves to ADMIN.
 *
 * Transport: Streamable HTTP (default) and SSE.
 *
 * OAuth flow:
 *   GET  /authorize  → login form redirect
 *   POST /login      → Better Auth sign-in, session stored in KV
 *   GET  /callback   → look up role, grant scopes, issue auth code
 *   POST /token      → exchange code for access token (handled by OAuthProvider)
 *   POST /register   → dynamic client registration (gated by initial access token, U4)
 */

import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';
import { dcrRegisterGate, PackRatAuthHandler } from './auth';
import { createMcpClients, errResponse, type McpClients, type McpToolResult } from './client';
import { ServiceMeta } from './constants';
import { applyCorsHeaders } from './cors';
import { buildResourceMetadata, SCOPES_SUPPORTED, unauthorizedResponse } from './metadata';
import {
  attachCorrelationId,
  correlationIdFrom,
  createLogger,
  syntheticCorrelationId,
} from './observability';
import { registerPrompts } from './prompts';
import { checkRateLimit, toolRateLimitKey } from './rate-limit';
import { registerResources } from './resources';
import { runScheduledPurge } from './scheduled';
import { getVisibleTools } from './scopes';
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
import type { AgentContext, Env } from './types';

export type { Env };

// ── Session state ─────────────────────────────────────────────────────────────

export interface State {
  /** Better Auth session token, injected per-request from OAuth props or a Bearer header. */
  authToken: string;
}

// ── MCP Agent (Durable Object) ────────────────────────────────────────────────

export class PackRatMCP extends McpAgent<Env, State, Record<string, never>> {
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
  registerFlaggedTool: AgentContext['registerFlaggedTool'] = (flag, ...args) => {
    // safe-cast: McpServer.registerTool's overloads collapse at the implementation level;
    // forwarding via spread requires a single call signature here.
    const tool = (this.server.registerTool as (...a: unknown[]) => RegisteredTool)(...args);
    const bucket = this._flaggedTools.get(flag) ?? [];
    bucket.push(tool);
    this._flaggedTools.set(flag, bucket);
    if (!this.isFlagEnabled(flag)) tool.disable();
    return tool;
  };

  setFeatureFlag(flag: string, enabled: boolean): void {
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
   *
   * Why wrap inside the proxy rather than walking `_toolsByName` after
   * registration to re-bind handlers? Re-binding would mean reaching
   * into the SDK's `RegisteredTool` shape (private fields) to swap the
   * callback. The proxy seam preserves the SDK contract — we only ever
   * pass our wrapped callback into `registerTool` itself.
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
      if (typeof originalHandler === 'function') {
        const wrappedHandler = this.wrapHandlerWithRateLimit(name, originalHandler);
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
   * `${props.userId}:${toolName}`. `props.userId` is set at OAuth time
   * (see `auth.ts/handleCallback`); legacy bearer-flow sessions where
   * `userId` is missing collapse to `:${toolName}` — acceptable because
   * the bearer-flow path is a rare back-compat surface.
   *
   * On exceed: returns the canonical U8 `errResponse('rate_limited', ...,
   * true)` envelope so the model gets a structured signal it can back
   * off and retry against. The wrapper does NOT alter `arguments` /
   * `extra` shape — the SDK validates the rest of the request boundary.
   */
  private wrapHandlerWithRateLimit(
    toolName: string,
    handler: (...handlerArgs: unknown[]) => unknown,
  ): (...handlerArgs: unknown[]) => unknown {
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
   * Best-effort lookup of the current OAuth user ID from `this.props`.
   *
   * `props` is injected by the OAuthProvider apiHandler before the DO
   * fetch hits us; for the rare back-compat bearer-only path where
   * `props` is undefined or `userId` is missing, returns `''` and the
   * rate-limit key collapses to `:${toolName}` — see
   * `wrapHandlerWithRateLimit` for the trade-off.
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
   *     (populated at OAuth `/callback` time by `auth.ts/handleCallback`).
   *     If `props` is missing (legacy bearer flow), both collapse to
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
   * `props.scopes` is set at `/callback` time (see `auth.ts/handleCallback`).
   * If absent (e.g. a legacy token issued before U5), we fall back to the
   * `['mcp']` umbrella scope per the back-compat contract documented in
   * `scopes.ts` — that scope only authorizes reads, so the worst-case
   * misclassification is "an admin-issued legacy token loses access to
   * admin tools until they re-auth".
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
    // `(this.props as { scopes?: readonly string[] }).scopes` — set at
    // OAuth `/callback` time per the U5 model.
    registerAdminTools(this);

    // ── Resources + prompts ────────────────────────────────────────────────
    registerResources(this);
    registerPrompts(this);

    // ── Scope-based visibility filter (U5) ─────────────────────────────────
    // `this.props` is injected by the OAuthProvider apiHandler before the
    // DO fetch hits us; legacy/missing scopes fall back to the umbrella
    // `['mcp']` per the back-compat contract.
    const props = this.props as { scopes?: readonly string[] } | undefined;
    const grantedScopes: readonly string[] =
      props?.scopes && props.scopes.length > 0 ? props.scopes : ['mcp'];
    this.applyScopeFilter(grantedScopes);
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BEARER_REGEX = /^Bearer\s+(\S+)/i;

const mcpDoHandler = PackRatMCP.serve('/mcp');

// ── Props schema (OAuthProvider injects this at runtime via ctx) ──────────────

const PropsSchema = z.object({
  betterAuthToken: z.string(),
  userId: z.string(),
  /**
   * U5: granted OAuth scopes. Required (not optional) so a malformed grant
   * surfaces as a 401 with `unauthorizedResponse` rather than silently
   * defaulting to "all tools visible". Legacy tokens issued before U5
   * landed will fail this schema and force a re-auth — acceptable for the
   * pre-listing transition, per the connector-store plan's "no soft
   * compat aliases" stance.
   */
  scopes: z.array(z.string()),
});

// ── API handler: wraps McpAgent, injecting the Better Auth token from OAuth props ──
//
// Adds the RFC 9728 `WWW-Authenticate: Bearer resource_metadata=...` header
// to every 401 response so MCP clients can discover the protected-resource
// metadata on first encounter.

const mcpApiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const rawCtx = ctx as unknown as Record<string, unknown>; // safe-cast: OAuth provider injects props at runtime; ExecutionContext has no index signature
    const propsResult = PropsSchema.safeParse(rawCtx.props);
    if (!propsResult.success) {
      return unauthorizedResponse(env, 'Missing or malformed OAuth props');
    }

    const { betterAuthToken: userToken } = propsResult.data;

    const headers = new Headers(request.headers);
    if (userToken) headers.set('Authorization', `Bearer ${userToken}`);

    const response = await mcpDoHandler.fetch(new Request(request, { headers }), env, ctx);

    // RFC 9728 §5.1: 401 responses from a protected resource MUST include a
    // WWW-Authenticate challenge with resource_metadata. The McpAgent
    // doesn't add this for us, so we annotate it here when needed.
    if (response.status === 401 && !response.headers.has('WWW-Authenticate')) {
      const annotated = new Response(response.body, response);
      annotated.headers.set(
        'WWW-Authenticate',
        `Bearer resource_metadata="https://mcp.packratai.com/.well-known/oauth-protected-resource", scope="mcp"`,
      );
      return annotated;
    }

    return response;
  },
};

// ── OAuthProvider — the Worker entrypoint ─────────────────────────────────────
//
// The provider auto-emits both well-known endpoints (RFC 8414 for AS metadata,
// RFC 9728 for protected-resource metadata). `resourceMetadata` pins the
// `resource` URL to our custom domain so Claude's audience-verification of
// issued tokens matches what the metadata advertises — silent drift here is
// a top connector-rejection cause.
//
// `disallowPublicClientRegistration: true` rejects public-client DCR (`none`
// token_endpoint_auth_method) inside the library itself. We *also* wrap
// the provider's `fetch` to gate every `/register` request on
// `Authorization: Bearer <MCP_INITIAL_ACCESS_TOKEN>` — see `dcrRegisterGate`
// in `auth.ts` for the rationale and fail-closed semantics. The library
// dispatches `/register` to its internal `handleClientRegistration` *before*
// any handler runs, so the gate must live above the provider (not inside
// `PackRatAuthHandler`).

const oauthProvider = new OAuthProvider<Env>({
  // /mcp and sub-paths are API routes: require a valid access token
  apiRoute: '/mcp',
  apiHandler: mcpApiHandler,

  // All other routes (/, /health, /authorize, /login, /callback) go to the auth handler
  defaultHandler: PackRatAuthHandler,

  // OAuth 2.1 endpoints (token + register are served by OAuthProvider itself)
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',

  // Security: S256 PKCE only; no implicit flow; restrict DCR to confidential
  // clients (the /register endpoint is further gated by MCP_INITIAL_ACCESS_TOKEN
  // in the outer fetch wrapper below — see U4).
  allowPlainPKCE: false,
  allowImplicitFlow: false,
  disallowPublicClientRegistration: true,

  // Token lifetimes: 60-min access tokens, 30-day refresh tokens. Refresh
  // tokens rotate by default in @cloudflare/workers-oauth-provider per
  // OAuth 2.1 §4.3.1; the rotation is verified in U17 integration tests.
  accessTokenTTL: 3600,
  refreshTokenTTL: 2592000,

  // Surface the full v1 scope catalog in /.well-known/oauth-authorization-server.
  scopesSupported: [...SCOPES_SUPPORTED],

  // Pin the protected-resource URL to the custom domain (env-invariant in v1).
  resourceMetadata: buildResourceMetadata({} as Env),

  // U15: forward provider-side OAuth errors to Workers Logs as structured
  // WARN events. The provider invokes this hook for invalid_grant,
  // invalid_client, invalid_scope, audience mismatch, etc. — every
  // OAuth failure response the library generates. We log only the
  // public `{ code, description, status }` fields; we never log the
  // request body, the bearer token, or any `props` payload.
  //
  // `internal` (when present) carries server-side-only diagnostic
  // context the library deliberately did NOT put on the wire (e.g. a
  // JWT validation failure category). We DO log that, but only the
  // `category` + `reason` strings — never `detail`, which can carry an
  // arbitrary payload that risks leaking issuer-side material.
  //
  // We don't return a Response: the library's default error response
  // shape is the right OAuth surface (RFC 6749 error envelope); we
  // just observe it.
  //
  // The correlation ID is synthesised here — the OAuthProvider hook
  // signature in v0.7.0 (see
  // `node_modules/@cloudflare/workers-oauth-provider/dist/oauth-provider.d.ts:556`)
  // does NOT expose the inbound Request, so we can't pivot to the
  // outer wrapper's per-request stash. We use the `oauth:` namespace
  // so an operator filter on `correlationId: oauth:*` returns every
  // provider-side error; Workers Logs still echoes `cf-ray` alongside
  // each line so cross-correlation with the zone log is one filter away.
  onError: ({ code, description, status, internal }) => {
    const log = createLogger({ correlationId: syntheticCorrelationId('oauth') });
    log.warn('mcp.oauth.error', {
      oauthCode: code,
      oauthStatus: status,
      description,
      ...(internal
        ? { error: { code: internal.category, message: internal.reason, retryable: false } }
        : {}),
    });
  },
});

/**
 * Worker entrypoint: gate `/register` on the initial access token first,
 * apply the CORS allowlist for `/.well-known/*` to Claude origins, then
 * delegate every other path to the OAuthProvider. Also exports a
 * `scheduled` handler for the U14 KV purge cron (daily at 04:00 UTC).
 *
 * Keeping the gate (and CORS) at this layer (vs. inside
 * `PackRatAuthHandler`) is load-bearing: the library routes `/register`
 * and `/.well-known/*` to its built-in handlers *before* the default
 * handler runs, so any logic inside `PackRatAuthHandler` would never fire
 * for those paths. The CORS logic itself lives in `./cors.ts` so it
 * stays testable without dragging the full agents/mcp module graph (and
 * its `cloudflare:workers` imports) into a Node-native vitest run.
 *
 * The `scheduled` handler delegates to `runScheduledPurge` in
 * `./scheduled.ts`, which calls `oauthProvider.purgeExpiredData(env)`
 * directly on the provider instance (NOT on `env.OAUTH_PROVIDER`, which
 * is the helpers object injected per-request and isn't available in a
 * scheduled handler context — see
 * `@cloudflare/workers-oauth-provider/dist/oauth-provider.d.ts:1191`).
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // U15: derive a correlation ID at the top of the wrapper and stash it
    // on the Request via a WeakMap so deep handlers (`dcrRegisterGate`,
    // `handleLoginPost`, `handleCallback`) can read it back without
    // plumbing it through every function signature. We also echo it
    // on every outbound response via `X-Correlation-Id` so operators
    // can trace a single request through Workers Logs + the upstream
    // Cloudflare zone log + Sentry by one value.
    const correlationId = correlationIdFrom(request);
    attachCorrelationId(request, correlationId);

    const gateResponse = dcrRegisterGate(request, env);
    if (gateResponse) return withCorrelationHeader(gateResponse, correlationId);

    // OPTIONS preflight short-circuit: handled entirely here, never hits
    // the OAuthProvider.
    if (request.method === 'OPTIONS') {
      const cors = applyCorsHeaders(request, null);
      if (cors) return withCorrelationHeader(cors, correlationId);
    }

    const response = await oauthProvider.fetch(request, env, ctx);

    // Annotate well-known GETs from allowed origins; everything else falls
    // through unchanged (default-deny — see `applyCorsHeaders`).
    const annotated = applyCorsHeaders(request, response);
    return withCorrelationHeader(annotated ?? response, correlationId);
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runScheduledPurge(oauthProvider, env);
  },
};

/**
 * Annotate an outbound response with `X-Correlation-Id: <id>`.
 *
 * Returns a new Response wrapping the same body — Response headers are
 * immutable once the response is consumed, so we always clone via the
 * `new Response(body, init)` shape. The body is streamed through
 * unchanged (no buffering).
 */
function withCorrelationHeader(response: Response, correlationId: string): Response {
  if (response.headers.has('X-Correlation-Id')) return response;
  const annotated = new Response(response.body, response);
  annotated.headers.set('X-Correlation-Id', correlationId);
  return annotated;
}
