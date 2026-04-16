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
 *  - JWT Bearer token authentication forwarded to PackRat API
 *
 * Transport: Streamable HTTP (default) and SSE
 * Auth: Authorization: Bearer <packrat-jwt>
 *
 * Connection URL: https://<your-worker>.workers.dev/mcp
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { PackRatApiClient } from './client';
import { ServiceMeta, WorkerRoute } from './constants';
import { registerPrompts } from './prompts';
import { registerResources } from './resources';
import { registerCatalogTools } from './tools/catalog';
import { registerKnowledgeTools } from './tools/knowledge';
import { registerPackTools } from './tools/packs';
import { registerTrailConditionTools } from './tools/trail-conditions';
import { registerTripTools } from './tools/trips';
import { registerWeatherTools } from './tools/weather';

// ── Environment type ──────────────────────────────────────────────────────────

export interface Env {
  /** Durable Object binding for MCP sessions */
  PackRatMCP: DurableObjectNamespace;
  /** Base URL of the PackRat API (e.g. "https://packrat.world") */
  PACKRAT_API_URL: string;
}

// ── Session state ─────────────────────────────────────────────────────────────

export interface State {
  /** JWT Bearer token extracted from the initial Authorization header */
  authToken: string;
}

// ── MCP Agent ─────────────────────────────────────────────────────────────────

export class PackRatMCP extends McpAgent<Env, State, Record<string, never>> {
  server = new McpServer({
    name: 'packrat',
    version: '1.0.0',
  });

  initialState: State = { authToken: '' };

  /**
   * Public API client, accessible from tool registration functions.
   * Lazily initialized on first use — reads auth token from current state.
   */
  private _api: PackRatApiClient | null = null;

  get api(): PackRatApiClient {
    if (!this._api) {
      this._api = new PackRatApiClient(this.env.PACKRAT_API_URL, () => this.state.authToken);
    }
    return this._api;
  }

  /**
   * Override the DO's fetch to capture the Authorization header and persist
   * it in state before the MCP protocol layer processes each message.
   * This ensures tools always have access to the current session's auth token.
   */
  override async fetch(request: Request): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.match(BEARER_REGEX)?.[1] ?? '';

    // Persist the latest auth token in state (including clearing stale tokens
    // when a request arrives without a valid bearer token).
    // setState is synchronous — state is updated before super.fetch processes
    // the MCP protocol message and calls any tool handlers.
    if (token !== this.state.authToken) {
      this.setState({ ...this.state, authToken: token });
    }

    return super.fetch(request);
  }

  /**
   * Called once when the Durable Object starts up.
   * Register all tools, resources, and prompts here.
   */
  async init(): Promise<void> {
    registerPackTools(this);
    registerCatalogTools(this);
    registerTripTools(this);
    registerWeatherTools(this);
    registerKnowledgeTools(this);
    registerTrailConditionTools(this);
    registerResources(this);
    registerPrompts(this);
  }
}

// ── Worker entry point ────────────────────────────────────────────────────────

const BEARER_REGEX = /^Bearer\s+(\S+)/i;

/**
 * The Cloudflare Worker fetch handler.
 *
 * Validates the Authorization header before routing to the McpAgent Durable Object.
 * The token is forwarded via the request and stored in DO state for tool calls.
 */
const mcpHandler = PackRatMCP.serve('/mcp');

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const url = new URL(request.url);

    // ── Health check ──────────────────────────────────────────────────────
    if (url.pathname === WorkerRoute.Root || url.pathname === WorkerRoute.Health) {
      return Response.json({
        status: 'ok',
        service: ServiceMeta.Name,
        version: ServiceMeta.Version,
        transport: ServiceMeta.Transport,
        endpoint: WorkerRoute.Mcp,
        docs: 'https://packrat.world/docs/mcp',
      });
    }

    // ── MCP endpoint ──────────────────────────────────────────────────────
    if (url.pathname === WorkerRoute.Mcp || url.pathname.startsWith(`${WorkerRoute.Mcp}/`)) {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.match(BEARER_REGEX)?.[1] ?? '';

      if (!token) {
        return Response.json(
          {
            error: 'Unauthorized',
            message:
              'Provide your PackRat JWT as: Authorization: Bearer <token>. ' +
              'Get your token from https://packrat.world/settings/api',
          },
          {
            status: 401,
            headers: {
              'WWW-Authenticate': 'Bearer realm="PackRat MCP Server"',
              'Content-Type': 'application/json',
            },
          },
        );
      }

      return mcpHandler.fetch(request, env, ctx);
    }

    // ── 404 ───────────────────────────────────────────────────────────────
    return Response.json(
      {
        error: 'Not Found',
        availableEndpoints: [
          { method: 'GET', path: WorkerRoute.Root, description: 'Health check' },
          { method: '*', path: WorkerRoute.Mcp, description: 'MCP endpoint (Streamable HTTP)' },
        ],
      },
      { status: 404 },
    );
  },
};
