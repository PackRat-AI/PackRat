import type { MessageBatch } from '@cloudflare/workers-types';
import { sentry } from '@hono/sentry';
import { OpenAPIHono } from '@hono/zod-openapi';
import { routes } from '@packrat/api/routes';
import { type BaseQueueMessage, processQueueBatch } from '@packrat/api/services/etl/queue';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import { configureOpenAPI } from '@packrat/api/utils/openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { CatalogService } from './services';
import { LogsQueueConsumer } from './services/LogsQueueConsumer';
import type { Variables } from './types/variables';

const app = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// Apply global middleware
app
  .use((c, next) => {
    return sentry({
      environment: getEnv(c).ENVIRONMENT,
      release: getEnv(c).CF_VERSION_METADATA.id,
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

// Configure OpenAPI documentation
configureOpenAPI(app);

// Scalar UI with enhanced configuration
app.get(
  '/scalar',
  Scalar({
    url: '/doc',
    theme: 'purple',
    pageTitle: 'PackRat API Documentation',
    defaultHttpClient: {
      targetKey: 'javascript',
      clientKey: 'fetch',
    },
  }),
);

// Health check endpoint
app.get('/', (c) => {
  return c.text('PackRat API is running!');
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<BaseQueueMessage>, env: Env): Promise<void> {
    if (batch.queue === 'packrat-etl-queue' || batch.queue === 'packrat-etl-queue-dev') {
      if (!env.ETL_QUEUE) {
        throw new Error('ETL_QUEUE is not configured');
      }
      await processQueueBatch({ batch, env });
    } else if (batch.queue === 'packrat-logs-queue' || batch.queue === 'packrat-logs-queue-dev') {
      if (!env.LOGS_QUEUE) {
        throw new Error('LOGS_QUEUE is not configured');
      }
      const consumer = new LogsQueueConsumer();
      await consumer.handle(batch, env);
    } else if (
      batch.queue === 'packrat-embeddings-queue' ||
      batch.queue === 'packrat-embeddings-queue-dev'
    ) {
      if (!env.EMBEDDINGS_QUEUE) {
        throw new Error('EMBEDDINGS_QUEUE is not configured');
      }
      await new CatalogService(env, false).handleEmbeddingsBatch(batch);
    } else {
      throw new Error(`Unknown queue: ${batch.queue}`);
    }
  },
};
