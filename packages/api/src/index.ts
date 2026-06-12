/**
 * Cloudflare Worker entry point.
 *
 * Elysia-based Worker using the official `CloudflareAdapter` (Elysia 1.4.x).
 * Better Auth handles all /api/auth/** requests; all other routes are
 * Elysia-native so Eden Treaty gets full end-to-end type safety.
 */

import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import type { MessageBatch, ScheduledController } from '@cloudflare/workers-types';
import { neonConfig } from '@neondatabase/serverless';
import { type App, appBase } from '@packrat/api/app';
import { getAuth } from '@packrat/api/auth';
import { consentRoute } from '@packrat/api/auth/consent-route';
import { AppContainer } from '@packrat/api/containers';
import { CatalogService } from '@packrat/api/services';
import { processQueueBatch } from '@packrat/api/services/etl/queue';
import { sweepInvalidItemLogs } from '@packrat/api/services/retention/invalidLogRetention';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv, setWorkerEnv } from '@packrat/api/utils/env-validation';
import {
  createQueryMetricsStore,
  flushQueryMetrics,
  initQueryMetricsStore,
  queryMetricsAls,
} from '@packrat/api/utils/queryMetrics';
import { captureApiException, record } from '@packrat/api/utils/sentry';
import { CatalogEtlWorkflow as RawCatalogEtlWorkflow } from '@packrat/api/workflows/catalog-etl-workflow';
import { instrumentWorkflowWithSentry, withSentry } from '@sentry/cloudflare';
import type { CatalogETLMessage } from './services/etl/types';

export type { App };

function sentryOptions(env: Env) {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    tracesSampleRate: 0.1,
    release: env.CF_VERSION_METADATA?.id,
  };
}

// Runtime instance: same routes as `App` plus the branded OAuth consent page.
export const app = appBase.use(consentRoute).compile();

export { AppContainer };

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
    // not a valid URL - leave neon defaults in place
  } finally {
    neonLocalConfigured = true;
  }
}

function flushFetchMetrics({ ctx, response }: { ctx: ExecutionContext; response: Response }): void {
  const metricsStore = queryMetricsAls.getStore();
  if (!metricsStore) return;

  metricsStore.totalDurationMs = Date.now() - metricsStore.startTimeMs;
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    metricsStore.estimatedEgressBytes = Number(contentLength);
    ctx.waitUntil(flushQueryMetrics({ store: metricsStore, statusCode: response.status }));
    return;
  }

  const ct = response.headers.get('content-type') ?? '';
  if (ct.startsWith('application/json') || ct.startsWith('text/')) {
    const clone = response.clone();
    ctx.waitUntil(
      clone.arrayBuffer().then((buf) => {
        metricsStore.estimatedEgressBytes = buf.byteLength;
        return flushQueryMetrics({ store: metricsStore, statusCode: response.status });
      }),
    );
    return;
  }

  ctx.waitUntil(flushQueryMetrics({ store: metricsStore, statusCode: response.status }));
}

const workerHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const e = enrichEnv(env);
    maybeConfigureLocalNeon(e.NEON_DATABASE_URL);
    setWorkerEnv(e as unknown as Record<string, unknown>); // safe-cast: setWorkerEnv accepts Record; ValidatedEnv has no index signature by design

    const metricsStore = initQueryMetricsStore(request);
    return queryMetricsAls.run(metricsStore, async () => {
      const url = new URL(request.url);

      if (request.method === 'GET') {
        if (
          url.pathname === '/.well-known/oauth-authorization-server' ||
          url.pathname === '/.well-known/openid-configuration'
        ) {
          const validatedEnv = getEnv();
          const auth = await getAuth(validatedEnv);
          const handler =
            url.pathname === '/.well-known/openid-configuration'
              ? oauthProviderOpenIdConfigMetadata(auth)
              : oauthProviderAuthServerMetadata(auth);
          const response = await handler(request);
          flushFetchMetrics({ ctx, response });
          return response;
        }
      }

      if (url.pathname.startsWith('/api/auth')) {
        const validatedEnv = getEnv();
        const auth = await getAuth(validatedEnv);
        const response = await auth.handler(request);
        flushFetchMetrics({ ctx, response });
        return response;
      }

      const response = await (app.fetch as unknown as CfFetchFn)(request, e, ctx); // safe-cast: Elysia's fetch has Cloudflare-specific env/ctx params not in the standard type
      flushFetchMetrics({ ctx, response });
      return response;
    });
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    setWorkerEnv(enrichEnv(env) as unknown as Record<string, unknown>); // safe-cast: same as fetch handler above

    const store = createQueryMetricsStore({ route: `queue/${batch.queue}`, method: 'QUEUE' });
    await queryMetricsAls.run(store, async () => {
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
          error,
          operation: 'queue.handler',
          tags: { queue_name: batch.queue },
          extra: { messageCount: batch.messages.length },
        });
        throw error;
      } finally {
        store.totalDurationMs = Date.now() - store.startTimeMs;
        await flushQueryMetrics({ store }).catch(() => {});
      }
    });
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    setWorkerEnv(enrichEnv(env) as unknown as Record<string, unknown>); // safe-cast: same as fetch handler above

    const store = createQueryMetricsStore({
      route: `scheduled/${controller.cron}`,
      method: 'CRON',
    });
    await queryMetricsAls.run(store, async () => {
      try {
        if (controller.cron === '0 9 * * *') {
          const result = await record({
            operation: 'sweepInvalidItemLogs',
            tags: { trigger: 'cron' },
            extra: { cron: controller.cron },
            fn: async () => sweepInvalidItemLogs({ env }),
          });
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
      } finally {
        store.totalDurationMs = Date.now() - store.startTimeMs;
        await flushQueryMetrics({ store }).catch(() => {});
      }
    });
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
