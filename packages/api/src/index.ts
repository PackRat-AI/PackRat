import type { MessageBatch } from '@cloudflare/workers-types';
import { sentry } from '@hono/sentry';
import { OpenAPIHono } from '@hono/zod-openapi';
import { routes } from '@packrat/api/routes';
import { processQueueBatch } from '@packrat/api/services/etl/queue';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import { configureOpenAPI } from '@packrat/api/utils/openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { ZodError } from 'zod';
import { CatalogService } from './services';
import type { CatalogETLMessage } from './services/etl/types';
import type { Variables } from './types/variables';

// Helper function to format Zod validation errors into user-friendly messages
function formatZodError(issues: any[]): string {
  if (issues.length === 0) return 'Validation error';
  
  // Check for common patterns and return specific messages
  const emailIssue = issues.find(issue => issue.path.includes('email'));
  const passwordIssue = issues.find(issue => issue.path.includes('password'));
  const idTokenIssue = issues.find(issue => issue.path.includes('idToken'));
  const codeIssue = issues.find(issue => issue.path.includes('code'));
  
  // Handle multiple required fields
  if (emailIssue && passwordIssue && emailIssue.code === 'invalid_type' && passwordIssue.code === 'invalid_type') {
    return 'Email and password are required';
  }
  
  if (emailIssue && codeIssue && emailIssue.code === 'invalid_type' && codeIssue.code === 'invalid_type') {
    return 'Email and verification code are required';
  }
  
  if (emailIssue && codeIssue && issues.some(i => i.path.includes('newPassword'))) {
    return 'Email, code, and new password are required';
  }
  
  // Handle single field issues
  if (idTokenIssue && idTokenIssue.code === 'invalid_type') {
    return 'ID token is required';
  }
  
  if (emailIssue && emailIssue.code === 'invalid_string' && emailIssue.validation === 'email') {
    return 'Invalid email format';
  }
  
  if (passwordIssue && passwordIssue.code === 'too_small') {
    return 'Password must be at least 8 characters';
  }
  
  // Default to first issue message
  return issues[0].message || 'Validation error';
}

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
      // If the HTTPException contains Zod validation errors, transform them
      if (err.message && err.message.includes('ZodError')) {
        try {
          const zodError = JSON.parse(err.message);
          if (zodError.name === 'ZodError' && zodError.issues) {
            return c.json({ error: formatZodError(zodError.issues) }, 400);
          }
        } catch (parseError) {
          // If parsing fails, fall through to the original HTTPException handling
        }
      }
      return err.getResponse();
    }
    
    if (err instanceof ZodError) {
      return c.json({ error: formatZodError(err.issues) }, 400);
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
      targetKey: 'js',
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
