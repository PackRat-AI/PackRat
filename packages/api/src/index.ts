import { routes } from "@/routes";
import { processQueueBatch } from "@/services/queue";
import { Env } from "@/types/env";
import { MessageBatch } from "@cloudflare/workers-types";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from 'hono/http-exception';
import { Variables } from './types/variables';
import { sentry } from '@hono/sentry';

const app = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// Apply global middleware
app
  .use((c, next) => {
    return sentry({
      environment: c.env.ENVIRONMENT,
      release: c.env.CF_VERSION_METADATA.id,
      // Adds request headers and IP for users, for more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/options/#sendDefaultPii
      sendDefaultPii: true,

      // Enable logs to be sent to Sentry
      _experiments: { enableLogs: true },
    })(c, next);
  })
  .use((c, next) => {
    const sentry = c.get('sentry');
    const user = c.get('user');
    if (user) {
      sentry.setUser(user);
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
app.use(logger());
app.use(cors());

// Mount routes
app.route('/api', routes);

// OpenAPI documentation and UI
app.doc('/doc', {
  openapi: '3.0.0',
  info: { title: 'PackRat API', version: '1.0.0' },
});
app.get('/scalar', Scalar({ url: '/doc' }));

// Health check endpoint
app.get('/', (c) => {
  return c.text('PackRat API is running!');
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    if (!env.ETL_QUEUE) {
      throw new Error("ETL_QUEUE is not configured");
    }
    await processQueueBatch({ batch, env });
  },
};

