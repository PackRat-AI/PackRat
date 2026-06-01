/**
 * The PackRat API as an Elysia app — the typed contract exported as `App` and
 * consumed by `@packrat/api-client` (Eden Treaty).
 *
 * This module is deliberately JSX-free. The browser-facing OAuth consent page
 * (server-rendered HTML via @kitajs/html) is mounted on the *runtime* worker in
 * `index.ts`, NOT here, so it stays out of `App`. Including it would drag the
 * @kitajs/html JSX type surface into every Eden consumer's typecheck
 * (packages/mcp, apps/*), even though those consumers never call it — the
 * consent page is reached by a mid-OAuth-flow user-agent redirect, not the
 * typed client. See `index.ts` for the runtime mount.
 */

import { cors } from '@elysiajs/cors';
import { routes } from '@packrat/api/routes';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { captureApiException, setRequestId } from '@packrat/api/utils/sentry';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';

export const appBase = new Elysia({ adapter: CloudflareAdapter })
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
  // Per-request correlation id. Cloudflare's `cf-ray` is stable across the
  // request (and visible in CF logs); fall back to a UUID off-platform. We
  // (1) tag the Sentry scope so the onError report and every
  // captureApiException/record event in this request share `request_id`,
  // (2) echo it in the X-Request-Id response header so a caller can quote it
  // back, and (3) expose it on the handler context as `requestId` (the one
  // thing the elysia-requestid plugin offered) so routes can read/log it.
  .derive(({ request, set }) => {
    const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
    setRequestId(requestId);
    set.headers['x-request-id'] = requestId;
    return { requestId };
  })
  .onError(({ error, code, request, route, path }) => {
    const requestId = request?.headers.get('cf-ray') ?? 'unknown';
    // Central route-error sink (Elysia's recommended pattern). Only report
    // unexpected server errors — not user-input or routing errors. Errors that
    // inner code already enriched via captureApiException/record are skipped by
    // the dedup marker, so this never double-reports.
    if (code !== 'VALIDATION' && code !== 'PARSE' && code !== 'NOT_FOUND') {
      captureApiException({
        error,
        // Group by the matched route TEMPLATE (e.g. /catalog/:id), not the
        // concrete path — low cardinality in Sentry. Concrete path goes to extra.
        operation: route ? `route ${request?.method ?? ''} ${route}`.trim() : 'elysia.onError',
        tags: {
          error_code: String(code),
          method: request?.method ?? 'UNKNOWN',
          route: route ?? 'UNKNOWN',
          request_id: requestId,
        },
        extra: {
          errorCode: String(code),
          httpStatus: 500,
          path: path ?? (request ? new URL(request.url).pathname : 'UNKNOWN'),
        },
      });
    }

    // Echo the correlation id in body + header so the caller can quote it.
    const headers = { 'Content-Type': 'application/json', 'X-Request-Id': requestId };
    if (code === 'VALIDATION' || code === 'PARSE') {
      return new Response(JSON.stringify({ error: 'Validation failed', requestId }), {
        status: 400,
        headers,
      });
    }
    if (code === 'NOT_FOUND') {
      return new Response(JSON.stringify({ error: 'Not found', requestId }), {
        status: 404,
        headers,
      });
    }
    return new Response(JSON.stringify({ error: 'Internal server error', requestId }), {
      status: 500,
      headers,
    });
  })
  .get('/', () => 'PackRat API is running!', {
    detail: { summary: 'Health check', tags: ['Meta'] },
  })
  .get('/health', () => ({ status: 'ok' as const }), {
    detail: { summary: 'Health status', tags: ['Meta'] },
  })
  .use(routes);

/**
 * Typed contract consumed by `@packrat/api-client` (Eden Treaty). Excludes the
 * browser-facing OAuth consent route (mounted only at runtime in `index.ts`).
 */
export type App = typeof appBase;
