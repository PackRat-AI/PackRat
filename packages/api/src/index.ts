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
import { type App, addCorsHeaders, appBase, corsPreflightResponse } from '@packrat/api/app';
import { getAuth } from '@packrat/api/auth';
import { consentRoute, signInRoute } from '@packrat/api/auth/consent-route';
import {
  isLocalE2EAuthEnabled,
  localE2EToken,
  makeLocalE2EUser,
} from '@packrat/api/auth/local-e2e';
import { AppContainer } from '@packrat/api/containers';
import { createDb } from '@packrat/api/db';
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
import { renderConsentPage, renderSignInPage } from '@packrat/consent-ui';
import * as dbSchema from '@packrat/db';
import { isString, toRecord, toString as toStr } from '@packrat/guards';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import { instrumentWorkflowWithSentry, withSentry } from '@sentry/cloudflare';
import { eq } from 'drizzle-orm';
import type { CatalogETLMessage } from './services/etl/types';

export type { App };

const bearerPrefixRegex = /^Bearer\s+/i;
const scopeSplitRegex = /\s+/;
const OAUTH_CONSENT_PATH = '/api/auth/oauth2/consent';
const OAUTH_AUTHORIZE_PATH = '/api/auth/oauth2/authorize';
const WELL_KNOWN_AUTH_SERVER_PATH = '/.well-known/oauth-authorization-server';
const WELL_KNOWN_OPENID_CONFIG_PATH = '/.well-known/openid-configuration';
const WELL_KNOWN_AUTH_BASE_PATH = '/api/auth';
const WELL_KNOWN_ALLOWED_ORIGINS = new Set(['https://claude.ai', 'https://claude.com']);
/** localhost origins get CORS on the well-known endpoints so MCP Inspector can drive OAuth discovery. */
const LOCALHOST_WELL_KNOWN_ORIGIN = /^http:\/\/localhost:\d+$/;

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

// Runtime instance: same routes as `App` plus the branded OAuth consent page.
export const app = appBase.use(signInRoute).use(consentRoute).compile();

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

async function handleLocalE2EAuth(request: Request, env: Env): Promise<Response | undefined> {
  if (!isLocalE2EAuthEnabled(env)) return undefined;

  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/api/auth/sign-in/email') {
    const body = (await request.json().catch(() => undefined)) as
      | { email?: string; password?: string }
      | undefined;
    const email = body?.email?.toLowerCase();
    if (email !== env.E2E_TEST_EMAIL?.toLowerCase() || body?.password !== env.E2E_TEST_PASSWORD) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await localE2EToken(env);
    return Response.json(
      {
        redirect: false,
        token,
        user: makeLocalE2EUser(env),
      },
      { headers: { 'set-auth-token': token } },
    );
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/sign-out') {
    const expected = await localE2EToken(env);
    const authorization = request.headers.get('Authorization') ?? '';
    if (authorization.replace(bearerPrefixRegex, '') === expected) {
      return Response.json({ success: true });
    }
  }

  return undefined;
}

function applyWellKnownCors(request: Request, response: Response | null): Response | null {
  const url = new URL(request.url);
  if (!isWellKnownMetadataPath(url.pathname)) return null;

  const origin = request.headers.get('Origin');
  if (
    !origin ||
    (!WELL_KNOWN_ALLOWED_ORIGINS.has(origin) && !LOCALHOST_WELL_KNOWN_ORIGIN.test(origin))
  )
    return null;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  if (!response || request.method !== 'GET') return null;
  const annotated = new Response(response.body, response);
  annotated.headers.set('Access-Control-Allow-Origin', origin);
  const existingVary = annotated.headers.get('Vary');
  annotated.headers.set('Vary', existingVary ? `${existingVary}, Origin` : 'Origin');
  return annotated;
}

function isWellKnownMetadataPath(pathname: string): boolean {
  return (
    pathname === WELL_KNOWN_AUTH_SERVER_PATH ||
    pathname === `${WELL_KNOWN_AUTH_SERVER_PATH}${WELL_KNOWN_AUTH_BASE_PATH}` ||
    pathname === WELL_KNOWN_OPENID_CONFIG_PATH ||
    pathname === `${WELL_KNOWN_OPENID_CONFIG_PATH}${WELL_KNOWN_AUTH_BASE_PATH}`
  );
}

function wellKnownMetadataKind(pathname: string): 'openid' | 'authorization-server' | null {
  if (
    pathname === WELL_KNOWN_OPENID_CONFIG_PATH ||
    pathname === `${WELL_KNOWN_OPENID_CONFIG_PATH}${WELL_KNOWN_AUTH_BASE_PATH}`
  ) {
    return 'openid';
  }
  if (
    pathname === WELL_KNOWN_AUTH_SERVER_PATH ||
    pathname === `${WELL_KNOWN_AUTH_SERVER_PATH}${WELL_KNOWN_AUTH_BASE_PATH}`
  ) {
    return 'authorization-server';
  }
  return null;
}

async function sanitizeOAuthConsentRequest(
  request: Request,
  env: Env,
): Promise<Request | Response> {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== OAUTH_CONSENT_PATH) return request;

  const auth = await getAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return request;

  const role = (session.user as unknown as { role?: string }).role ?? 'USER';
  if (role === 'ADMIN') return request;

  // Consent body is now JSON (the consent page switched from form-urlencoded to
  // fetch+JSON so Better Auth's /oauth2/consent endpoint accepts it). Parse,
  // strip mcp:admin for non-admins, and rewrite the body.
  const text = await request.text();
  let body: { accept?: unknown; scope?: unknown; oauth_query?: unknown };
  try {
    body = safeJsonParse(text) as typeof body;
  } catch {
    return Response.json(
      { error: 'invalid_request', error_description: 'Consent body must be JSON' },
      { status: 400 },
    );
  }

  const postedScope = isString(body.scope) ? body.scope : null;
  if (postedScope === null) {
    return Response.json(
      { error: 'invalid_scope', error_description: 'scope is required for consent' },
      { status: 400 },
    );
  }

  const reducedScope = postedScope
    .split(scopeSplitRegex)
    .filter((scope) => scope && scope !== 'mcp:admin')
    .join(' ');

  const sanitized = safeJsonStringify({ ...body, scope: reducedScope });
  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  headers.delete('content-length');
  return new Request(request.url, {
    method: request.method,
    headers,
    body: sanitized,
    redirect: request.redirect,
  });
}

// Strip `mcp:admin` from the authorize request scope for non-admin users so
// the already-stored consent (which never includes mcp:admin for non-admins)
// covers the entire requested set and the consent page isn't shown on every
// reconnect. Admin users pass through unchanged — their consent records DO
// include mcp:admin since it's never filtered on their path.
async function sanitizeAuthorizeRequest(request: Request, env: Env): Promise<Request> {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== OAUTH_AUTHORIZE_PATH) return request;
  const scope = url.searchParams.get('scope');
  if (!scope?.includes('mcp:admin')) return request;

  const auth = await getAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return request;

  const role = (session.user as unknown as { role?: string }).role ?? 'USER';
  if (role === 'ADMIN') return request;

  const reducedScope = scope
    .split(scopeSplitRegex)
    .filter((s) => s && s !== 'mcp:admin')
    .join(' ');
  const newUrl = new URL(request.url);
  newUrl.searchParams.set('scope', reducedScope);
  return new Request(newUrl.toString(), {
    method: request.method,
    headers: request.headers,
    redirect: request.redirect,
  });
}

// Local-dev hook: route `@neondatabase/serverless` through Neon's official local
// proxy (`ghcr.io/timowilhelm/local-neon-http-proxy`, see docker-compose.test.yml
// and https://neon.com/guides/local-development-with-neon) when NEON_DATABASE_URL
// points at `db.localtest.me`. The proxy serves the HTTP /sql API (neon-http,
// used by auth) and the WebSocket /v2 endpoint (neon-serverless Pool), so local
// and prod share the exact same driver path — no node-postgres TCP sockets
// (which workerd silently drops between requests).
let neonLocalConfigured = false;
function maybeConfigureLocalNeon(opts: {
  databaseUrl: string | undefined;
  proxyPortOverride: string | undefined;
}): void {
  const { databaseUrl, proxyPortOverride } = opts;
  if (neonLocalConfigured || !databaseUrl) return;
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    if (host !== 'db.localtest.me') return;
    const proxyPort = proxyPortOverride ?? '4444';
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
    maybeConfigureLocalNeon({
      databaseUrl: e.NEON_DATABASE_URL,
      proxyPortOverride: e.NEON_LOCAL_PROXY_PORT,
    });
    setWorkerEnv(e as unknown as Record<string, unknown>); // safe-cast: setWorkerEnv accepts Record; ValidatedEnv has no index signature by design

    const metricsStore = initQueryMetricsStore(request);
    return queryMetricsAls.run(metricsStore, async () => {
      const url = new URL(request.url);

      const corsPreflight = applyWellKnownCors(request, null);
      if (corsPreflight) {
        flushFetchMetrics({ ctx, response: corsPreflight });
        return corsPreflight;
      }

      if (request.method === 'GET') {
        const metadataKind = wellKnownMetadataKind(url.pathname);
        if (metadataKind) {
          const validatedEnv = getEnv();
          const auth = await getAuth(validatedEnv);
          const handler =
            metadataKind === 'openid'
              ? oauthProviderOpenIdConfigMetadata(auth)
              : oauthProviderAuthServerMetadata(auth);
          const response = await handler(request);
          const annotated = applyWellKnownCors(request, response) ?? response;
          flushFetchMetrics({ ctx, response: annotated });
          return annotated;
        }
      }

      // Sign-in and consent pages for the OAuth flow — intercepted before any
      // other handler so neither Better Auth nor Elysia routing interferes.
      if (request.method === 'GET' && url.pathname === '/api/auth/sign-in') {
        const callbackURL = url.searchParams.get('callbackURL') ?? '';
        const html = renderSignInPage({ callbackURL });
        const response = new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
          },
        });
        flushFetchMetrics({ ctx, response });
        return response;
      }

      if (request.method === 'GET' && url.pathname === '/oauth/consent') {
        const validatedEnv = getEnv();
        const auth = await getAuth(validatedEnv);
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          const signInUrl = new URL('/api/auth/sign-in', url.origin);
          signInUrl.searchParams.set('callbackURL', url.toString());
          const response = new Response(null, {
            status: 302,
            headers: { Location: signInUrl.toString(), 'Cache-Control': 'no-store' },
          });
          flushFetchMetrics({ ctx, response });
          return response;
        }

        const clientId = url.searchParams.get('client_id') ?? '';
        if (!clientId) {
          const response = new Response('Missing client_id', { status: 400 });
          flushFetchMetrics({ ctx, response });
          return response;
        }

        const db = createDb();
        const clientRows = await db
          .select()
          .from(dbSchema.oauthClient)
          .where(eq(dbSchema.oauthClient.clientId, clientId))
          .limit(1);
        const clientRow = clientRows[0] as
          | {
              clientId: string;
              name: string;
              icon?: string | null;
              tos?: string | null;
              policy?: string | null;
              uri?: string | null;
            }
          | undefined;

        if (!clientRow) {
          const response = new Response(`Unknown OAuth client: ${clientId}`, { status: 404 });
          flushFetchMetrics({ ctx, response });
          return response;
        }

        const userRole = toStr(toRecord(session.user).role) ?? 'USER';
        const isAdmin = userRole === 'ADMIN';
        const requestedScopes = (url.searchParams.get('scope') ?? '')
          .split(scopeSplitRegex)
          .filter(Boolean);
        const approvableScopes = requestedScopes.filter((s) => isAdmin || s !== 'mcp:admin');
        const oauthQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;

        const html = renderConsentPage({
          user: { name: session.user.name, email: session.user.email },
          isAdmin,
          client: {
            clientId: clientRow.clientId,
            name: clientRow.name,
            icon: clientRow.icon ?? undefined,
            tos: clientRow.tos ?? undefined,
            policy: clientRow.policy ?? undefined,
            uri: clientRow.uri ?? undefined,
          },
          requestedScopes,
          approvableScopes,
          oauthQuery,
        });

        const response = new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
          },
        });
        flushFetchMetrics({ ctx, response });
        return response;
      }

      if (url.pathname.startsWith('/api/auth')) {
        const authPreflight = corsPreflightResponse(request);
        if (authPreflight) {
          flushFetchMetrics({ ctx, response: authPreflight });
          return authPreflight;
        }

        const validatedEnv = getEnv();
        const localAuthResponse = await handleLocalE2EAuth(request, validatedEnv);
        if (localAuthResponse) {
          const annotated = addCorsHeaders({ request, response: localAuthResponse });
          flushFetchMetrics({ ctx, response: annotated });
          return annotated;
        }
        const auth = await getAuth(validatedEnv);
        const authorizeRequest = await sanitizeAuthorizeRequest(request, validatedEnv);
        const sanitizedRequest = await sanitizeOAuthConsentRequest(authorizeRequest, validatedEnv);
        if (sanitizedRequest instanceof Response) {
          const annotated = addCorsHeaders({ request, response: sanitizedRequest });
          flushFetchMetrics({ ctx, response: annotated });
          return annotated;
        }
        const response = addCorsHeaders({
          request,
          response: await auth.handler(sanitizedRequest),
        });
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
