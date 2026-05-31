import { cors } from '@elysiajs/cors';
import { routes } from '@packrat/api/routes';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { captureApiException } from '@packrat/api/utils/sentry';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?packrat\.world$/,
  /^https:\/\/[\w-]+\.packrat\.world$/,
  /^https:\/\/[\w-]+\.packratai\.com$/,
  /^https?:\/\/[\w-]+\.workers\.dev$/,
  /^http:\/\/localhost:\d+$/,
  /^exp:\/\//,
];

export const app = new Elysia({ adapter: CloudflareAdapter })
  .use(
    cors({
      credentials: true,
      origin: (request) => {
        const origin = request.headers.get('Origin');
        if (!origin) return false;
        return ALLOWED_ORIGINS.some((re) => re.test(origin));
      },
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )
  .use(packratOpenApi)
  .onError(({ error, code, request }) => {
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
