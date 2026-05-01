/**
 * PackRat MCP Server
 *
 * A full-featured Model Context Protocol server for outdoor adventure planning,
 * built on Cloudflare Workers + Durable Objects using the Cloudflare Agents SDK.
 *
 * Features:
 *  - 20+ tools: packs, gear catalog, trips, weather, trail conditions, outdoor knowledge
 *  - MCP resources: pack/trip/gear data accessible by URI
 *  - Guided prompts: trip planning, pack optimization, gear recommendations
 *  - Stateful sessions with hibernation (via Durable Objects)
 *  - OAuth 2.1 + PKCE authorization via @cloudflare/workers-oauth-provider
 *
 * Transport: Streamable HTTP (default) and SSE
 *
 * OAuth flow:
 *   GET  /authorize  → login form redirect
 *   POST /login      → Better Auth sign-in, session stored in KV
 *   GET  /callback   → issue auth code, redirect to client
 *   POST /token      → exchange code for access token (handled by OAuthProvider)
 *   POST /register   → dynamic client registration (handled by OAuthProvider)
 */

import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';
import { PackRatAuthHandler } from './auth';
import type { PackRatApiClient } from './client';
import { createPackRatClient } from './client';
import { registerPrompts } from './prompts';
import { registerResources } from './resources';
import { registerCatalogTools } from './tools/catalog';
import { registerKnowledgeTools } from './tools/knowledge';
import { registerPackTools } from './tools/packs';
import { registerTrailConditionTools } from './tools/trail-conditions';
import { registerTrailTools } from './tools/trails';
import { registerTripTools } from './tools/trips';
import { registerWeatherTools } from './tools/weather';
import type { Env } from './types';

// Re-export Env for consumers (e.g. tests)
export type { Env };

// ── Session state ─────────────────────────────────────────────────────────────

export interface State {
  /** Better Auth session token, injected per-request from OAuth props or legacy Bearer header */
  authToken: string;
}

// ── MCP Agent (Durable Object) ────────────────────────────────────────────────

export class PackRatMCP extends McpAgent<Env, State, Record<string, never>> {
  server = new McpServer({
    name: 'packrat',
    version: '1.0.0',
  });

  initialState: State = { authToken: '' };

  private _api: PackRatApiClient | null = null;

  get api(): PackRatApiClient {
    if (!this._api) {
      this._api = createPackRatClient(this.env.PACKRAT_API_URL, () => this.state.authToken);
    }
    return this._api;
  }

  override async fetch(request: Request): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.match(BEARER_REGEX)?.[1] ?? '';

    if (token !== this.state.authToken) {
      this.setState({ ...this.state, authToken: token });
    }

    return super.fetch(request);
  }

  async init(): Promise<void> {
    registerPackTools(this);
    registerCatalogTools(this);
    registerTripTools(this);
    registerWeatherTools(this);
    registerKnowledgeTools(this);
    registerTrailConditionTools(this);
    registerTrailTools(this);
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
});

// ── API handler: wraps McpAgent, injecting the Better Auth token from OAuth props ──

const mcpApiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const rawCtx = ctx as unknown as Record<string, unknown>;
    const propsResult = PropsSchema.safeParse(rawCtx.props);
    const token = propsResult.success ? propsResult.data.betterAuthToken : '';

    const headers = new Headers(request.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
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
