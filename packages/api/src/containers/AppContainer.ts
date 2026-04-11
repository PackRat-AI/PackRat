import { env } from 'cloudflare:workers';
import { Container } from '@cloudflare/containers';
import type { Env } from '@packrat/api/types/env';

// Type the module-level env binding with our known env shape
const typedEnv = env as unknown as Env;

/**
 * App Container class that runs the Node.js TikTok service.
 * Extends Cloudflare's Container class for proper container lifecycle management.
 *
 * This container handles TikTok API integration which requires a full Node.js runtime
 * for libraries that don't work in the Cloudflare Workers environment.
 */
export class AppContainer extends Container<Env> {
  // Port the container listens on - use CONTAINER_PORT env var or default to 8080
  defaultPort = Number(typedEnv.CONTAINER_PORT) || 8080;
  // Time before container sleeps due to inactivity (5 minutes for TikTok API calls)
  sleepAfter = '5m';

  envVars = {
    CLOUDFLARE_ACCOUNT_ID: typedEnv.CLOUDFLARE_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: typedEnv.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: typedEnv.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: typedEnv.PACKRAT_BUCKET_R2_BUCKET_NAME,
    R2_PUBLIC_URL: typedEnv.R2_PUBLIC_URL,
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
