/**
 * Legacy Hono sub-application.
 *
 * During the staged migration to Elysia we continue to serve the majority of
 * routes through the existing Hono OpenAPIHono app. The outer Elysia runtime
 * in `src/index.ts` mounts this Hono instance via `app.mount('/api', honoApp.fetch)`
 * so CORS, observability, OpenAPI, and request logging live in Elysia while
 * individual route handlers remain untouched.
 *
 * As routes are ported to Elysia-native plugins they should be removed from
 * this Hono app and added to `src/elysia-routes.ts` instead.
 */
import { sentry } from '@hono/sentry';
import { OpenAPIHono } from '@hono/zod-openapi';
import { routes } from '@packrat/api/routes';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';

export const honoApp = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

honoApp
  .use((c, next) => {
    return sentry({
      environment: getEnv(c).ENVIRONMENT,
      release: getEnv(c).CF_VERSION_METADATA.id,
      sendDefaultPii: true,
      _experiments: { enableLogs: true },
    })(c, next);
  })
  .use((c, next) => {
    const s = c.get('sentry');
    const user = c.get('user');
    if (user) {
      s?.setUser(user as Record<string, unknown>);
    }
    return next();
  })
  .onError((err, c) => {
    console.error('Error occurred:', err);
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    return c.json({ error: 'Internal server error' }, 500);
  });
honoApp.use(logger());

// All legacy /api/... routes live under this mount.
honoApp.route('/api', routes);
