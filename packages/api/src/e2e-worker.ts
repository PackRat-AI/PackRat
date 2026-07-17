import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import type { MessageBatch } from '@cloudflare/workers-types';
import { addCorsHeaders, appBase, corsPreflightResponse } from '@packrat/api/app';
import { getAuth } from '@packrat/api/auth';
import { type Env, getEnv, setWorkerEnv } from '@packrat/api/utils/env-validation';

const WELL_KNOWN_AUTH_SERVER_PATH = '/.well-known/oauth-authorization-server';
const WELL_KNOWN_OPENID_CONFIG_PATH = '/.well-known/openid-configuration';
const WELL_KNOWN_AUTH_BASE_PATH = '/api/auth';

function enrichEnv(env: Env): Env {
  if (env.OSM_HYPERDRIVE) {
    return { ...env, OSM_DATABASE_URL: env.OSM_HYPERDRIVE.connectionString };
  }
  return env;
}

function wellKnownMetadataKind(pathname: string): 'openid' | 'authorization-server' | null {
  if (
    pathname === WELL_KNOWN_OPENID_CONFIG_PATH ||
    pathname === `${WELL_KNOWN_OPENID_CONFIG_PATH}${WELL_KNOWN_AUTH_BASE_PATH}`
  ) {
    return 'openid';
  }
  if (
    pathname === WELL_KNOWN_AUTH_SERVER_PATH ||
    pathname === `${WELL_KNOWN_AUTH_SERVER_PATH}${WELL_KNOWN_AUTH_BASE_PATH}`
  ) {
    return 'authorization-server';
  }
  return null;
}

export default {
  // biome-ignore lint/complexity/useMaxParams: Cloudflare Worker fetch callbacks receive request, env, and context.
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const e = getEnv(enrichEnv(env) as unknown as Record<string, unknown>);
    setWorkerEnv(e as unknown as Record<string, unknown>);

    const url = new URL(request.url);
    if (request.method === 'GET') {
      const metadataKind = wellKnownMetadataKind(url.pathname);
      if (metadataKind) {
        const auth = await getAuth(e);
        const handler =
          metadataKind === 'openid'
            ? oauthProviderOpenIdConfigMetadata(auth)
            : oauthProviderAuthServerMetadata(auth);
        return handler(request);
      }
    }

    if (url.pathname.startsWith('/api/auth')) {
      const preflight = corsPreflightResponse(request);
      if (preflight) return preflight;

      const auth = await getAuth(e);
      return addCorsHeaders({ request, response: await auth.handler(request) });
    }

    return Reflect.apply(appBase.fetch, appBase, [request, e, ctx]);
  },

  async queue(_batch: MessageBatch<unknown>): Promise<void> {
    return;
  },
};
