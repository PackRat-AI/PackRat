/**
 * Cloudflare Worker entry point.
 *
 * Elysia-based Worker using the official `CloudflareAdapter` (Elysia 1.4.x).
 * Better Auth handles all /api/auth/** requests; all other routes are
 * Elysia-native so Eden Treaty gets full end-to-end type safety.
 */

import type { MessageBatch } from '@cloudflare/workers-types';
import { cors } from '@elysiajs/cors';
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
    setWorkerEnv(e as unknown as Record<string, unknown>);

    // Route /api/auth/** to Better Auth before Elysia sees it.
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth')) {
      const validatedEnv = getEnv();
      const auth = await getAuth(validatedEnv);
      return auth.handler(request);
    }

    return (app.fetch as unknown as CfFetchFn)(request, e, ctx);
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    setWorkerEnv(enrichEnv(env) as unknown as Record<string, unknown>);

    if (batch.queue === 'packrat-etl-queue' || batch.queue === 'packrat-etl-queue-dev') {
      if (!env.ETL_QUEUE) throw new Error('ETL_QUEUE is not configured');
      await processQueueBatch({ batch: batch as MessageBatch<CatalogETLMessage>, env });
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
