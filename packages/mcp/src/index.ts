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
 *  - Per-session admin JWT, supplied via `X-PackRat-Admin-Token` or `admin_login`.
 *
 * Transport: Streamable HTTP (default) and SSE.
 *
 * OAuth flow:
 *   GET  /authorize  → login form redirect
 *   POST /login      → Better Auth sign-in, session stored in KV
 *   GET  /callback   → issue auth code, redirect to client
 *   POST /token      → exchange code for access token (handled by OAuthProvider)
 *   POST /register   → dynamic client registration (handled by OAuthProvider)
 */

import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';
import { PackRatAuthHandler } from './auth';
import { createMcpClients, type McpClients } from './client';
import { registerPrompts } from './prompts';
import { registerResources } from './resources';
import { registerAdminTools } from './tools/admin';
import { registerAiTools } from './tools/ai';
import { registerAlltrailsTools } from './tools/alltrails';
import { registerAuthTools } from './tools/auth';
import { registerCatalogTools } from './tools/catalog';
import { registerFeedTools } from './tools/feed';
import { registerGuidesTools } from './tools/guides';
import { registerKnowledgeTools } from './tools/knowledge';
import { registerPackTemplateTools } from './tools/packTemplates';
import { registerPackTools } from './tools/packs';
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
  /** Admin JWT, populated by `admin_login` or injected via `X-PackRat-Admin-Token`. */
  adminToken: string;
}

// ── MCP Agent (Durable Object) ────────────────────────────────────────────────

export class PackRatMCP extends McpAgent<Env, State, Record<string, never>> {
  server = new McpServer({
    name: 'packrat',
    version: '2.0.0',
  });

  initialState: State = { authToken: '', adminToken: '' };

  private _api: McpClients | null = null;
  private _adminTools: RegisteredTool[] = [];
  private _flaggedTools: Map<string, RegisteredTool[]> = new Map();
  private _flagState: Map<string, boolean> = new Map();

  get api(): McpClients {
    if (!this._api) {
      this._api = createMcpClients({
        baseUrl: this.apiBaseUrl,
        getUserToken: () => this.state.authToken,
        getAdminToken: () => this.state.adminToken,
      });
    }
    return this._api;
  }

  get apiBaseUrl(): string {
    return this.env.PACKRAT_API_URL;
  }

  /** Replace the per-session admin token. Toggles visibility of admin tools. */
  setAdminToken(token: string): void {
    if (token === this.state.adminToken) return;
    this.setState({ ...this.state, adminToken: token });
    this.syncAdminToolVisibility();
  }

  /**
   * Register a tool that's only listed when an admin JWT is on the session.
   * Mirrors `server.registerTool` and toggles visibility via the MCP SDK's
   * `enable()/disable()` (which emits `tools/list_changed`).
   */
  registerAdminTool: McpServer['registerTool'] = (...args) => {
    // safe-cast: McpServer.registerTool's overloads collapse at the implementation level;
    // forwarding via spread requires a single call signature here.
    const tool = (this.server.registerTool as (...a: unknown[]) => RegisteredTool)(...args);
    this._adminTools.push(tool);
    if (!this.state.adminToken) tool.disable();
    return tool;
  };

  private syncAdminToolVisibility(): void {
    const enabled = Boolean(this.state.adminToken);
    for (const tool of this._adminTools) {
      if (enabled && !tool.enabled) tool.enable();
      else if (!enabled && tool.enabled) tool.disable();
    }
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

  override async fetch(request: Request): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const userToken = authHeader?.match(BEARER_REGEX)?.[1] ?? '';
    const adminToken = request.headers.get('X-PackRat-Admin-Token') ?? '';

    const nextAuth = userToken || this.state.authToken;
    const nextAdmin = adminToken || this.state.adminToken;
    if (nextAuth !== this.state.authToken || nextAdmin !== this.state.adminToken) {
      this.setState({ ...this.state, authToken: nextAuth, adminToken: nextAdmin });
    }

    return super.fetch(request);
  }

  async init(): Promise<void> {
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

    // ── Admin (admin JWT) ──────────────────────────────────────────────────
    registerAdminTools(this);

    // ── Resources + prompts ────────────────────────────────────────────────
    registerResources(this);
    registerPrompts(this);
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BEARER_REGEX = /^Bearer\s+(\S+)/i;

const mcpDoHandler = PackRatMCP.serve('/mcp');

// ── Props schema (OAuthProvider injects this at runtime via ctx) ──────────────

const PropsSchema = z.object({
  betterAuthToken: z.string(),
  userId: z.string(),
  adminToken: z.string().optional(),
});

// ── API handler: wraps McpAgent, injecting the Better Auth token from OAuth props ──

const mcpApiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const rawCtx = ctx as unknown as Record<string, unknown>; // safe-cast: OAuth provider injects props at runtime; ExecutionContext has no index signature
    const propsResult = PropsSchema.safeParse(rawCtx.props);
    const userToken = propsResult.success ? propsResult.data.betterAuthToken : '';
    const adminToken = propsResult.success ? (propsResult.data.adminToken ?? '') : '';

    const headers = new Headers(request.headers);
    if (userToken) headers.set('Authorization', `Bearer ${userToken}`);
    if (adminToken && !headers.has('X-PackRat-Admin-Token')) {
      headers.set('X-PackRat-Admin-Token', adminToken);
    }

    return mcpDoHandler.fetch(new Request(request, { headers }), env, ctx);
  },
};

// ── OAuthProvider — the Worker entrypoint ─────────────────────────────────────

export default new OAuthProvider<Env>({
  // /mcp and sub-paths are API routes: require a valid access token
  apiRoute: '/mcp',
  apiHandler: mcpApiHandler,

  // All other routes (/, /health, /authorize, /login, /callback) go to the auth handler
  defaultHandler: PackRatAuthHandler,

  // OAuth 2.1 endpoints (token + register are served by OAuthProvider itself)
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',

  // Security: S256 PKCE only; no implicit flow
  allowPlainPKCE: false,
  allowImplicitFlow: false,

  // Token lifetimes: 60-min access tokens, 30-day refresh tokens
  accessTokenTTL: 3600,
  refreshTokenTTL: 2592000,

  scopesSupported: ['mcp'],
});
