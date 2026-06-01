import type { MessageBatch } from '@cloudflare/workers-types';
import { app } from '@packrat/api/app';
import { getAuth } from '@packrat/api/auth';
import type { Env } from '@packrat/api/utils/env-validation';
import { setWorkerEnv } from '@packrat/api/utils/env-validation';

function enrichEnv(env: Env): Env {
  if (env.OSM_HYPERDRIVE) {
    return { ...env, OSM_DATABASE_URL: env.OSM_HYPERDRIVE.connectionString };
  }
  return env;
}

export default {
  // biome-ignore lint/complexity/useMaxParams: Cloudflare Worker fetch callbacks receive request, env, and context.
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const e = enrichEnv(env);
    setWorkerEnv(Object.assign({}, e));

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth')) {
      const auth = await getAuth(e);
      return auth.handler(request);
    }

    return Reflect.apply(app.fetch, app, [request, e, ctx]);
  },

  async queue(_batch: MessageBatch<unknown>): Promise<void> {
    return;
  },
};
