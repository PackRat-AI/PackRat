import type { MessageBatch } from '@cloudflare/workers-types';
import { sentry } from '@hono/sentry';
import { OpenAPIHono } from '@hono/zod-openapi';
import { AppContainer } from '@packrat/api/containers';
import { routes } from '@packrat/api/routes';
import type { adminRpcRoutes } from '@packrat/api/routes/admin';
import { aiRoutes } from '@packrat/api/routes/ai';
import { authRoutes } from '@packrat/api/routes/auth';
import { catalogRoutes } from '@packrat/api/routes/catalog';
import { chatRoutes } from '@packrat/api/routes/chat';
import { feedRoutes } from '@packrat/api/routes/feed';
import { guidesRoutes } from '@packrat/api/routes/guides';
import { packsRoutes } from '@packrat/api/routes/packs';
import { packTemplatesRoutes } from '@packrat/api/routes/packTemplates';
import { seasonSuggestionsRoutes } from '@packrat/api/routes/seasonSuggestions';
import { trailConditionsRoutes } from '@packrat/api/routes/trailConditions';
import { tripsRoutes } from '@packrat/api/routes/trips';
import { uploadRoutes } from '@packrat/api/routes/upload';
import { userRoutes } from '@packrat/api/routes/user';
import { weatherRoutes } from '@packrat/api/routes/weather';
import { wildlifeRoutes } from '@packrat/api/routes/wildlife';
import { processQueueBatch } from '@packrat/api/services/etl/queue';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import { configureOpenAPI } from '@packrat/api/utils/openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { CatalogService } from './services';
import type { CatalogETLMessage } from './services/etl/types';
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

// Mount routes — explicit openapiRoutes slices for hc<> type inference
// (full routes mount exceeds TS depth limit; each domain must use openapiRoutes for RPC typing)
const rpcRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>()
  .route('/api/auth', authRoutes)
  .route('/api/catalog', catalogRoutes)
  .route('/api/guides', guidesRoutes)
  .route('/api/trips', tripsRoutes)
  .route('/api/packs', packsRoutes)
  .route('/api/feed', feedRoutes)
  .route('/api/ai', aiRoutes)
  .route('/api/chat', chatRoutes)
  .route('/api/weather', weatherRoutes)
  .route('/api/pack-templates', packTemplatesRoutes)
  .route('/api/season-suggestions', seasonSuggestionsRoutes)
  .route('/api/user', userRoutes)
  .route('/api/upload', uploadRoutes)
  .route('/api/trail-conditions', trailConditionsRoutes)
  .route('/api/wildlife', wildlifeRoutes);
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
      targetKey: 'js',
      clientKey: 'fetch',
    },
  }),
);

// Health check endpoint
app.get('/', (c) => {
  return c.text('PackRat API is running!');
});

export type AppType = typeof rpcRoutes;
export type AdminAppType = typeof adminRpcRoutes;

// Export the AppContainer class for Cloudflare Container binding
export { AppContainer, app };

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    if (batch.queue === 'packrat-etl-queue' || batch.queue === 'packrat-etl-queue-dev') {
      if (!env.ETL_QUEUE) {
        throw new Error('ETL_QUEUE is not configured');
      }
      await processQueueBatch({ batch: batch as MessageBatch<CatalogETLMessage>, env });
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
