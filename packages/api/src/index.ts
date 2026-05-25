/**
 * Cloudflare Worker entry point.
 *
 * Elysia-based Worker using the official `CloudflareAdapter` (Elysia 1.4.x).
 * Better Auth handles all /api/auth/** requests; all other routes are
 * Elysia-native so Eden Treaty gets full end-to-end type safety.
 */

import type { MessageBatch, ScheduledController } from '@cloudflare/workers-types';
import { cors } from '@elysiajs/cors';
import { getAuth } from '@packrat/api/auth';
import { AppContainer } from '@packrat/api/containers';
import { routes } from '@packrat/api/routes';
import { CatalogService } from '@packrat/api/services';
import { processQueueBatch } from '@packrat/api/services/etl/queue';
import { sweepInvalidItemLogs } from '@packrat/api/services/retention/invalidLogRetention';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv, setWorkerEnv } from '@packrat/api/utils/env-validation';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { captureApiException } from '@packrat/api/utils/sentry';
import { CatalogEtlWorkflow as RawCatalogEtlWorkflow } from '@packrat/api/workflows/catalog-etl-workflow';
import { instrumentWorkflowWithSentry, withSentry } from '@sentry/cloudflare';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import type { CatalogETLMessage } from './services/etl/types';

// Sentry options for both the Worker handlers and the workflow class.
// Reads SENTRY_DSN + ENVIRONMENT from the validated env. tracesSampleRate
// defaults to 10% — observable enough for prod debugging without
// overwhelming the Sentry quota.
function sentryOptions(env: Env) {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    tracesSampleRate: 0.1,
    release: env.CF_VERSION_METADATA?.id,
  };
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
          /^https:\/\/[\w-]+\.packratai\.com$/,
          /^https?:\/\/[\w-]+\.workers\.dev$/,
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
  .use(routes)
  .compile();

export type App = typeof app;

export { AppContainer };

// Wrap the workflow class with Sentry instrumentation so each step.do span
// + any uncaught throw inside a step lands in Sentry with workflow/instance
// context attached automatically.
export const CatalogEtlWorkflow = instrumentWorkflowWithSentry(
  sentryOptions,
  RawCatalogEtlWorkflow,
);

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

const workerHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const e = enrichEnv(env);
    setWorkerEnv(e as unknown as Record<string, unknown>); // safe-cast: setWorkerEnv accepts Record; ValidatedEnv has no index signature by design

    // Route /api/auth/** to Better Auth before Elysia sees it.
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth')) {
      const validatedEnv = getEnv();
      const auth = await getAuth(validatedEnv);
      return auth.handler(request);
    }

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

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    setWorkerEnv(enrichEnv(env) as unknown as Record<string, unknown>); // safe-cast: same as fetch handler above

    if (controller.cron === '0 9 * * *') {
      const result = await sweepInvalidItemLogs(env);
      console.log(
        `[retention] invalid_item_logs sweep: deleted=${result.deleted} ` +
          `iterations=${result.iterations} capped=${result.capped} ` +
          `retentionDays=${result.retentionDays}`,
      );
      if (result.capped) {
        console.warn(
          `[retention] invalid_item_logs sweep hit max-iterations cap; ` +
            `remaining expired rows will be swept on the next run`,
        );
      }
      return;
    }

    throw new Error(`Unknown cron: ${controller.cron}`);
  },
} satisfies ExportedHandler<Env>;

// withSentry wraps the fetch/queue/scheduled handlers to initialize Sentry
// on first invocation and forward uncaught exceptions to Sentry. The
// instrumented workflow class is exported separately above.
export default withSentry(sentryOptions, workerHandler);
