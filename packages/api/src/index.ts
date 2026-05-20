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
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv, setWorkerEnv } from '@packrat/api/utils/env-validation';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { captureApiException } from '@packrat/api/utils/sentry';
import { withSentry } from '@sentry/cloudflare';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import type { CatalogETLMessage } from './services/etl/types';

// Origins allowed to make cross-origin (credentialed) requests to the API.
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?packrat\.world$/,
  /^https:\/\/[\w-]+\.packrat\.world$/,
  /^https:\/\/[\w-]+\.packratai\.com$/,
  /^https?:\/\/[\w-]+\.workers\.dev$/,
  /^http:\/\/localhost:\d+$/,
  /^exp:\/\//,
];

function isAllowedOrigin(origin: string | null): origin is string {
  return !!origin && ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

export const app = new Elysia({ adapter: CloudflareAdapter })
  .use(
    cors({
      // Better Auth uses cookies — credentials must be true and origins must
      // be explicit (not wildcard) so the browser sends cookies cross-origin.
      credentials: true,
      origin: (request) => isAllowedOrigin(request.headers.get('Origin')),
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )
  .use(packratOpenApi)
  .onError(({ error, code, request }) => {
    // Only report unexpected server errors — not user-input or routing errors.
    if (code !== 'VALIDATION' && code !== 'PARSE' && code !== 'NOT_FOUND') {
      captureApiException({
        error: error,
        operation: 'elysia.onError',
        tags: {
          error_code: String(code),
          method: request?.method ?? 'UNKNOWN',
          path: request ? new URL(request.url).pathname : 'UNKNOWN',
        },
        extra: { errorCode: String(code), httpStatus: 500 },
      });
    }

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
  // Better Auth handles all /api/auth/** requests. Routing it through Elysia
  // (rather than dispatching before Elysia) means the `cors` plugin above
  // applies its credentialed-CORS policy and OPTIONS preflight to auth routes
  // too. `auth` is resolved per-request because it depends on the Cloudflare
  // env bindings, which are only available at request time.
  .all(
    '/api/auth/*',
    async ({ request }) => {
      const auth = await getAuth(getEnv());
      return auth.handler(request);
    },
    { parse: 'none', detail: { hide: true } },
  )
  .use(routes)
  .compile();

export type App = typeof app;

export { AppContainer };

// U1 spike (throwaway — delete after Workflows GO/NO-GO).
export { SpikeEtlWorkflow } from '@packrat/api/workflows/spike-etl-workflow';

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

// Local-dev hook: route `@neondatabase/serverless` through Neon's official local
// proxy (`ghcr.io/timowilhelm/local-neon-http-proxy`, see docker-compose.test.yml
// and https://neon.com/guides/local-development-with-neon) when NEON_DATABASE_URL
// points at `db.localtest.me`. The proxy serves the HTTP /sql API (neon-http,
// used by auth) and the WebSocket /v2 endpoint (neon-serverless Pool), so local
// and prod share the exact same driver path — no node-postgres TCP sockets
// (which workerd silently drops between requests).
let neonLocalConfigured = false;
function maybeConfigureLocalNeon(databaseUrl: string | undefined): void {
  if (neonLocalConfigured || !databaseUrl) return;
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    if (host !== 'db.localtest.me') return;
    const proxyPort = '4444';
    neonConfig.fetchEndpoint = (h) =>
      h === 'db.localtest.me' ? `http://${h}:${proxyPort}/sql` : `https://${h}/sql`;
    neonConfig.wsProxy = (h) => (h === 'db.localtest.me' ? `${h}:${proxyPort}/v2` : `${h}/v2`);
    neonConfig.useSecureWebSocket = false;
  } catch {
    // not a valid URL — leave neon defaults in place
  } finally {
    neonLocalConfigured = true;
  }
}

const workerHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const e = enrichEnv(env);
    maybeConfigureLocalNeon(e.NEON_DATABASE_URL);
    setWorkerEnv(e as unknown as Record<string, unknown>); // safe-cast: setWorkerEnv accepts Record; ValidatedEnv has no index signature by design

    return (app.fetch as unknown as CfFetchFn)(request, e, ctx); // safe-cast: Elysia's fetch has Cloudflare-specific env/ctx params not in the standard type
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    setWorkerEnv(enrichEnv(env) as unknown as Record<string, unknown>); // safe-cast: same as fetch handler above

    try {
      if (batch.queue === 'packrat-etl-queue' || batch.queue === 'packrat-etl-queue-dev') {
        if (!env.ETL_QUEUE) throw new Error('ETL_QUEUE is not configured');
        await processQueueBatch({ batch: batch as MessageBatch<CatalogETLMessage>, env }); // safe-cast: batch queue name checked above; MessageBatch<unknown> is compatible at runtime
      } else if (
        batch.queue === 'packrat-embeddings-queue' ||
        batch.queue === 'packrat-embeddings-queue-dev'
      ) {
        if (!env.EMBEDDINGS_QUEUE) throw new Error('EMBEDDINGS_QUEUE is not configured');
        await new CatalogService({ explicitEnv: env, useHttpDriver: true }).handleEmbeddingsBatch(
          batch,
        );
      } else {
        throw new Error(`Unknown queue: ${batch.queue}`);
      }
    } catch (error) {
      captureApiException({
        error: error,
        operation: 'queue.handler',
        tags: { queue_name: batch.queue },
        extra: { messageCount: batch.messages.length },
      });
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

export default withSentry<Env>(
  (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT ?? 'production',
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
    release: env.SENTRY_RELEASE,
  }),
  workerHandler,
);
