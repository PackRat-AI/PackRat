import { Container } from '@cloudflare/containers';
import type { Env } from '@packrat/api/types/env';

/**
 * TikTok Container class that runs the Node.js TikTok service.
 * Extends Cloudflare's Container class for proper container lifecycle management.
 *
 * This container handles TikTok API integration which requires a full Node.js runtime
 * for libraries that don't work in the Cloudflare Workers environment.
 */
export class TikTokContainer extends Container<Env> {
  // Port the container listens on
  defaultPort = 8080;
  // Time before container sleeps due to inactivity (5 minutes for TikTok API calls)
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
