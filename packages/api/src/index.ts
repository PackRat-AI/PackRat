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
import { captureApiException, record } from '@packrat/api/utils/sentry';
import { CatalogEtlWorkflow as RawCatalogEtlWorkflow } from '@packrat/api/workflows/catalog-etl-workflow';
import { instrumentWorkflowWithSentry, withSentry } from '@sentry/cloudflare';
import type { CatalogETLMessage } from './services/etl/types';

export type { App };

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

// Runtime instance: same routes as `App` (defined in `./app`) plus the branded
// OAuth consent page,
// mounted at /oauth/consent. The Better Auth OAuth provider redirects the
// user-agent here mid-flow; the @elysiajs/html plugin (inside consentRoute)
// sets Content-Type: text/html on JSX returns. `workerHandler` serves this.
export const app = appBase.use(consentRoute).compile();

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

    const url = new URL(request.url);

    // RFC 5785 + MCP spec: OAuth AS discovery + OIDC config served at root.
    // Better Auth's default mount is under /api/auth/.well-known/..., which
    // doesn't satisfy clients that expect root paths (Anthropic's connector
    // explicitly probes the root). The plugin's helpers (verified exports
    // from @better-auth/oauth-provider/dist/index.d.mts) return Workers-
    // compatible Response objects; we intercept before Better Auth's own
    // /api/auth dispatcher to make sure the path-matching is exact.
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
        return handler(request);
      }
    }

    // Route /api/auth/** to Better Auth before Elysia sees it.
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
  },
} satisfies ExportedHandler<Env>;

// withSentry wraps the fetch/queue/scheduled handlers to initialize Sentry
// on first invocation and forward uncaught exceptions to Sentry. The
// instrumented workflow class is exported separately above.
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
