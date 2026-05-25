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
import { cors } from '@elysiajs/cors';
import { neon } from '@neondatabase/serverless';
import { getAuth } from '@packrat/api/auth';
import { handleConsentPage } from '@packrat/api/auth/consent-page';
import { AppContainer } from '@packrat/api/containers';
import { routes } from '@packrat/api/routes';
import { CatalogService } from '@packrat/api/services';
import { processQueueBatch } from '@packrat/api/services/etl/queue';
import { sweepInvalidItemLogs } from '@packrat/api/services/retention/invalidLogRetention';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv, setWorkerEnv } from '@packrat/api/utils/env-validation';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { CatalogEtlWorkflow as RawCatalogEtlWorkflow } from '@packrat/api/workflows/catalog-etl-workflow';
import * as dbSchema from '@packrat/db';
import { instrumentWorkflowWithSentry, withSentry } from '@sentry/cloudflare';
import { drizzle } from 'drizzle-orm/neon-http';
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

const handler: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const e = enrichEnv(env);
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

      // Branded consent page served at the path declared in the plugin's
      // `consentPage` option. The plugin redirects the user-agent here mid-
      // OAuth-flow; the page reads the user's session, filters scopes for
      // non-admins, and POSTs back to /api/auth/oauth2/consent. See
      // src/auth/consent-page.ts for the full mechanism.
      if (url.pathname === '/oauth/consent') {
        const validatedEnv = getEnv();
        const auth = await getAuth(validatedEnv);
        const db = drizzle(neon(validatedEnv.NEON_DATABASE_URL), { schema: dbSchema });
        return handleConsentPage(request, { auth, db, schema: dbSchema });
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
};

// withSentry wraps the fetch/queue/scheduled handlers to initialize Sentry
// on first invocation and forward uncaught exceptions to Sentry. The
// instrumented workflow class is exported separately above.
export default withSentry(sentryOptions, handler);
