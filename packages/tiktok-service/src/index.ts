import { Container, getContainer } from '@cloudflare/containers';
import { Hono } from 'hono';

/**
 * TikTok Container class that runs the Node.js TikTok service.
 * Extends Cloudflare's Container class for proper container lifecycle management.
 */
export class TikTokContainer extends Container<Env> {
  // Port the container listens on (default: 8080)
  defaultPort = 8080;
  // Time before container sleeps due to inactivity (default: 30s)
  sleepAfter = '5m';
  // Environment variables passed to the container
  envVars = {
    NODE_ENV: 'production',
    PORT: '8080',
  };

  // Optional lifecycle hooks
  override onStart() {
    console.log('TikTok container successfully started');
  }

  override onStop() {
    console.log('TikTok container successfully shut down');
  }

  override onError(error: unknown) {
    console.log('TikTok container error:', error);
  }
}

// Create Hono app with proper typing for Cloudflare Workers
const app = new Hono<{
  Bindings: Env;
}>();

// Home route with available endpoints
app.get('/', (c) => {
  return c.text(
    'TikTok Service - Cloudflare Container\n\n' +
      'Available endpoints:\n' +
      'GET /health - Health check endpoint\n' +
      'POST /import - Import TikTok slideshow images\n' +
      'GET /singleton - Get TikTok container instance',
  );
});

// Health check endpoint - proxies to container
app.get('/health', async (c) => {
  const container = getContainer(c.env.TIKTOK_CONTAINER);
  return await container.fetch(c.req.raw);
});

// TikTok import endpoint - proxies to container
app.post('/import', async (c) => {
  const container = getContainer(c.env.TIKTOK_CONTAINER);
  return await container.fetch(c.req.raw);
});

// Get a single container instance (singleton pattern)
app.get('/singleton', async (c) => {
  const container = getContainer(c.env.TIKTOK_CONTAINER);
  return await container.fetch(c.req.raw);
});

export default app;
