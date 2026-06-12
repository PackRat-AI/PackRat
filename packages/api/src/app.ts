/**
 * The PackRat API as an Elysia app - the typed contract exported as `App` and
 * consumed by `@packrat/api-client` (Eden Treaty).
 *
 * This module is deliberately JSX-free. The browser-facing OAuth consent page
 * is mounted on the runtime worker in `index.ts`, not here, so it stays out of
 * `App` and does not pull JSX types into every Eden consumer.
 */

import { cors } from '@elysiajs/cors';
import { routes } from '@packrat/api/routes';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { captureApiException, setRequestId } from '@packrat/api/utils/sentry';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?packrat\.world$/,
  /^https:\/\/[\w-]+\.packrat\.world$/,
  /^https:\/\/[\w-]+\.packratai\.com$/,
  /^https?:\/\/[\w-]+\.workers\.dev$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^exp:\/\//,
];

export function isAllowedCorsOrigin(origin: string | null): origin is string {
  return !!origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
}

export function addCorsHeaders({
  request,
  response,
}: {
  request: Request;
  response: Response;
}): Response {
  const origin = request.headers.get('Origin');
  if (!isAllowedCorsOrigin(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Expose-Headers', 'set-auth-token');
  headers.append('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflightResponse(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const origin = request.headers.get('Origin');
  if (!isAllowedCorsOrigin(origin)) return new Response(null, { status: 204 });

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      Vary: 'Origin',
    },
  });
}

export const appBase = new Elysia({ adapter: CloudflareAdapter })
  .use(
    cors({
      credentials: true,
      origin: (request) => isAllowedCorsOrigin(request.headers.get('Origin')),
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )
  .use(packratOpenApi)
  .derive(({ request, set }) => {
    const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
    setRequestId(requestId);
    set.headers['x-request-id'] = requestId;
    return { requestId };
  })
  .onError(({ error, code, request, route, path }) => {
    const requestId = request?.headers.get('cf-ray') ?? 'unknown';
    if (code !== 'VALIDATION' && code !== 'PARSE' && code !== 'NOT_FOUND') {
      captureApiException({
        error,
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
  .use(routes)
  .compile();

export type App = typeof appBase;
