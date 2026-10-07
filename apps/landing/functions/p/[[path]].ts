/**
 * Cloudflare Pages Function for shared-post links (`/p/{publicId}`).
 *
 * packratai.com is a Pages project (root `apps/landing`, output `out/`), so
 * per-request code runs as a Pages Function rather than a Worker `main`.
 * This file only adapts the Pages context to the shared handler in
 * `worker/index.ts`, which fetches the post and writes its link-preview tags
 * into the static `/p` shell.
 */
import handler, { type Env } from '../../worker/index';

/** Production API. Override per environment with the `PACKRAT_API_URL` Pages variable. */
const DEFAULT_API_URL = 'https://packrat-api.orange-frost-d665.workers.dev';

type PagesContext = {
  request: Request;
  env: { ASSETS: Env['ASSETS']; PACKRAT_API_URL?: string };
};

export const onRequest = ({ request, env }: PagesContext): Promise<Response> =>
  handler.fetch(request, {
    ASSETS: env.ASSETS,
    PACKRAT_API_URL: env.PACKRAT_API_URL || DEFAULT_API_URL,
  });
