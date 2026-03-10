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

  /**
   * Environment variables passed to the container runtime.
   * Uses a getter to access the worker's env and pass R2 credentials to the container.
   */
  override get envVars(): Record<string, string> {
    return {
      NODE_ENV: 'production',
      PORT: '8080',
      // R2 credentials from worker environment
      CLOUDFLARE_ACCOUNT_ID: this.env.CLOUDFLARE_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: this.env.PACKRAT_BUCKET_R2_BUCKET_NAME,
      R2_PUBLIC_URL: `https://pub-${this.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev`,
    };
  }

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
