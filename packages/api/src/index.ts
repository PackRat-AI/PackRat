/**
 * Cloudflare Worker entry point.
 *
 * Elysia-based Worker using the official `CloudflareAdapter` (Elysia 1.4.x).
 * Every route is Elysia-native so Eden Treaty gets full end-to-end type
 * safety and @elysiajs/openapi generates a complete OpenAPI/Scalar UI.
 */
// Side-effect import that installs a no-op `.openapi()` method on Zod's
// prototype so legacy schemas can keep their `.openapi(...)` chains.
import '@packrat/api/utils/zod-shim';

import type { MessageBatch } from '@cloudflare/workers-types';
import { cors } from '@elysiajs/cors';
import { AppContainer } from '@packrat/api/containers';
import { routes } from '@packrat/api/routes';
import { CatalogService } from '@packrat/api/services';
import { processQueueBatch } from '@packrat/api/services/etl/queue';
import type { Env } from '@packrat/api/types/env';
import { setWorkerEnv } from '@packrat/api/utils/env-validation';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import type { CatalogETLMessage } from './services/etl/types';

/**
 * Root Elysia application – exported so Eden Treaty can infer the full route
 * surface.
 */
export const app = new Elysia({ adapter: CloudflareAdapter })
  .use(cors())
  .use(packratOpenApi)
  .onError(({ error, code }) => {
    console.error('Error occurred:', error);
    if (code === 'VALIDATION') {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: error.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
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

/**
 * End-to-end type exported for the Eden Treaty client (see
 * `apps/expo/lib/api/client.ts`).
 */
export type App = typeof app;

export { AppContainer };

type CfFetchFn = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    setWorkerEnv(env as unknown as Record<string, unknown>);
    return (app.fetch as unknown as CfFetchFn)(request, env, ctx);
  },
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    setWorkerEnv(env as unknown as Record<string, unknown>);

    if (batch.queue === 'packrat-etl-queue' || batch.queue === 'packrat-etl-queue-dev') {
      if (!env.ETL_QUEUE) {
        throw new Error('ETL_QUEUE is not configured');
      }
      await processQueueBatch({ batch: batch as MessageBatch<CatalogETLMessage>, env });
    } else if (
      batch.queue === 'packrat-embeddings-queue' ||
      batch.queue === 'packrat-embeddings-queue-dev'
    ) {
      if (!env.EMBEDDINGS_QUEUE) {
        throw new Error('EMBEDDINGS_QUEUE is not configured');
      }
      await new CatalogService(env, true).handleEmbeddingsBatch(batch);
    } else {
      throw new Error(`Unknown queue: ${batch.queue}`);
    }
  },
} satisfies ExportedHandler<Env>;
