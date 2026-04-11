/**
 * Cloudflare Worker entry point.
 *
 * This is now an Elysia-based Worker. The outer framework is Elysia (using
 * `CloudflareAdapter` which is the officially-supported way to run Elysia on
 * Cloudflare Workers as of Elysia 1.4.x). Legacy Hono routes are mounted via
 * Elysia's `.mount()` during the staged migration.
 *
 * The exported `App` type is consumed by `@elysiajs/eden` Treaty in the Expo
 * app so that the end-to-end type safety promise of the Elysia ecosystem is
 * preserved as more routes are ported from Hono to Elysia.
 */
import type { MessageBatch } from '@cloudflare/workers-types';
import { cors } from '@elysiajs/cors';
import { AppContainer } from '@packrat/api/containers';
import { honoApp } from '@packrat/api/hono-app';
import { CatalogService } from '@packrat/api/services';
import { processQueueBatch } from '@packrat/api/services/etl/queue';
import type { Env } from '@packrat/api/types/env';
import { setWorkerEnv } from '@packrat/api/utils/env-validation';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import type { CatalogETLMessage } from './services/etl/types';

/**
 * Elysia application root. Exports its own type so that `eden` treaty clients
 * can infer the full route surface.
 */
export const app = new Elysia({ adapter: CloudflareAdapter })
  .use(cors())
  .use(packratOpenApi)
  .get('/', () => 'PackRat API is running!', {
    detail: { summary: 'Health check', tags: ['Meta'] },
  })
  .get('/health', () => ({ status: 'ok' as const }), {
    detail: { summary: 'Health status', tags: ['Meta'] },
  })
  // Mount the legacy Hono application. Elysia forwards requests into Hono,
  // which owns the entire `/api/*` surface area during the staged migration
  // away from Hono. As individual route groups are ported to Elysia they are
  // moved out of the Hono sub-app and added natively on this Elysia instance
  // so Eden Treaty can provide end-to-end types for them.
  .mount(honoApp.fetch)
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
    // Prime the isolate-level env cache so `getEnv()` works everywhere without
    // needing to be threaded through the request context.
    setWorkerEnv(env as unknown as Record<string, unknown>);
    // Elysia's CloudflareAdapter compiles an app whose `.fetch` is a
    // Cloudflare Worker exported handler `fetch` compatible function.
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
      await new CatalogService(env, false).handleEmbeddingsBatch(batch);
    } else {
      throw new Error(`Unknown queue: ${batch.queue}`);
    }
  },
} satisfies ExportedHandler<Env>;
