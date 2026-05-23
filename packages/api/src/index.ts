/**
 * Cloudflare Worker entry point.
 *
 * Elysia-based Worker using the official `CloudflareAdapter` (Elysia 1.4.x).
 * Better Auth handles all /api/auth/** requests; all other routes are
 * Elysia-native so Eden Treaty gets full end-to-end type safety.
 */

import type { MessageBatch } from '@cloudflare/workers-types';
import { cors } from '@elysiajs/cors';
import { neonConfig } from '@neondatabase/serverless';
import { getAuth } from '@packrat/api/auth';
import { AppContainer } from '@packrat/api/containers';
import { routes } from '@packrat/api/routes';
import { CatalogService } from '@packrat/api/services';
import { processQueueBatch } from '@packrat/api/services/etl/queue';
import type { Env } from '@packrat/api/types/env';
import { getEnv, setWorkerEnv } from '@packrat/api/utils/env-validation';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import type { CatalogETLMessage } from './services/etl/types';

// Local-dev hook: route `@neondatabase/serverless` through Neon's official
// local proxy (`ghcr.io/timowilhelm/local-neon-http-proxy`, recommended by
// https://neon.com/guides/local-development-with-neon) when NEON_DATABASE_URL
// points at the local `db.localtest.me` host. The proxy serves both the HTTP
// /sql API (used by neon-http, which is what auth/index.ts uses) and the
// WebSocket /v2 endpoint (used by neon-serverless Pool) — so prod and local
// share the exact same driver code paths with no adapter switch.
let neonLocalConfigured = false;
function maybeConfigureLocalNeon(databaseUrl: string): void {
  if (neonLocalConfigured) return;
  try {
    const u = new URL(databaseUrl);
    const host = u.hostname.toLowerCase();
    const isNeon =
      host === 'neon.tech' ||
      host.endsWith('.neon.tech') ||
      host === 'neon.com' ||
      host.endsWith('.neon.com');
    if (isNeon) return;
    const proxyPort = process.env.NEON_LOCAL_PROXY_PORT ?? '4444';
    neonConfig.fetchEndpoint = (h) =>
      h === 'db.localtest.me' ? `http://${h}:${proxyPort}/sql` : `https://${h}/sql`;
    neonConfig.wsProxy = (h) => (h === 'db.localtest.me' ? `${h}:${proxyPort}/v2` : `${h}/v2`);
    neonConfig.useSecureWebSocket = host !== 'db.localtest.me';
  } finally {
    neonLocalConfigured = true;
  }
}

export const app = new Elysia({ adapter: CloudflareAdapter })
  .use(
    cors({
      // Better Auth uses cookies — credentials must be true and origins must
      // be explicit (not wildcard) so the browser sends cookies cross-origin.
      credentials: true,
      origin: (request) => {
        const origin = request.headers.get('Origin');
        if (!origin) return false;
        // Allow the API base URL and any subdomain of packrat.world
        const allowed = [
          /^https:\/\/(www\.)?packrat\.world$/,
          /^https:\/\/[\w-]+\.packrat\.world$/,
          /^http:\/\/localhost:\d+$/,
          /^exp:\/\//,
        ];
        return allowed.some((re) => re.test(origin));
      },
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )
  .use(packratOpenApi)
  .onError(({ error, code }) => {
    console.error('Error occurred:', error);
    if (code === 'VALIDATION' || code === 'PARSE') {
      return new Response(JSON.stringify({ error: 'Validation failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (code === 'NOT_FOUND') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  })
  .get('/', () => 'PackRat API is running!', {
    detail: { summary: 'Health check', tags: ['Meta'] },
  })
  .get('/health', () => ({ status: 'ok' as const }), {
    detail: { summary: 'Health status', tags: ['Meta'] },
  })
  .use(routes)
  .compile();

export type App = typeof app;

export { AppContainer };

type CfFetchFn = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

function enrichEnv(env: Env): Env {
  if (env.OSM_HYPERDRIVE) {
    return { ...env, OSM_DATABASE_URL: env.OSM_HYPERDRIVE.connectionString };
  }
  return env;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const e = enrichEnv(env);
    setWorkerEnv(e as unknown as Record<string, unknown>); // safe-cast: setWorkerEnv accepts Record; ValidatedEnv has no index signature by design
    maybeConfigureLocalNeon(e.NEON_DATABASE_URL);

    // Route /api/auth/** to Better Auth before Elysia sees it.
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth')) {
      // Better Auth does not implement CORS preflight (OPTIONS) responses, so
      // we mirror the Elysia CORS allowlist here. Without this, browser-based
      // sign-in calls from the web app (a different origin than the API) fail
      // the preflight and never reach Better Auth.
      const origin = request.headers.get('Origin');
      const isAllowedOrigin =
        !!origin &&
        [
          /^https:\/\/(www\.)?packrat\.world$/,
          /^https:\/\/[\w-]+\.packrat\.world$/,
          /^https:\/\/[\w-]+\.packratai\.com$/,
          /^https?:\/\/[\w-]+\.workers\.dev$/,
          /^http:\/\/localhost:\d+$/,
          /^exp:\/\//,
        ].some((re) => re.test(origin));

      const corsHeaders: Record<string, string> = isAllowedOrigin
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            Vary: 'Origin',
          }
        : {};

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            ...corsHeaders,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers':
              request.headers.get('Access-Control-Request-Headers') ??
              'Content-Type, Authorization, X-API-Key',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      const validatedEnv = getEnv();
      const auth = await getAuth(validatedEnv);
      const authResponse = await auth.handler(request);
      if (!isAllowedOrigin) return authResponse;
      // Copy Better Auth's response and append CORS headers so cookies/JSON
      // payloads reach the cross-origin caller.
      const headers = new Headers(authResponse.headers);
      for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
      return new Response(authResponse.body, {
        status: authResponse.status,
        statusText: authResponse.statusText,
        headers,
      });
    }

    return (app.fetch as unknown as CfFetchFn)(request, e, ctx); // safe-cast: Elysia's fetch has Cloudflare-specific env/ctx params not in the standard type
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    setWorkerEnv(enrichEnv(env) as unknown as Record<string, unknown>); // safe-cast: same as fetch handler above

    if (batch.queue === 'packrat-etl-queue' || batch.queue === 'packrat-etl-queue-dev') {
      if (!env.ETL_QUEUE) throw new Error('ETL_QUEUE is not configured');
      await processQueueBatch({ batch: batch as MessageBatch<CatalogETLMessage>, env }); // safe-cast: batch queue name checked above; MessageBatch<unknown> is compatible at runtime
    } else if (
      batch.queue === 'packrat-embeddings-queue' ||
      batch.queue === 'packrat-embeddings-queue-dev'
    ) {
      if (!env.EMBEDDINGS_QUEUE) throw new Error('EMBEDDINGS_QUEUE is not configured');
      await new CatalogService(env, true).handleEmbeddingsBatch(batch);
    } else {
      throw new Error(`Unknown queue: ${batch.queue}`);
    }
  },
} satisfies ExportedHandler<Env>;
