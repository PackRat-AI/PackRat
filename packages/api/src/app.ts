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
import { captureApiException } from '@packrat/api/utils/sentry';
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
  .use(routes);

/**
 * Typed contract consumed by `@packrat/api-client` (Eden Treaty). Excludes the
 * browser-facing OAuth consent route (mounted only at runtime in `index.ts`).
 */
export type App = typeof appBase;
