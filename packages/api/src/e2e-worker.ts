import type { MessageBatch } from '@cloudflare/workers-types';
import { addCorsHeaders, appBase, corsPreflightResponse } from '@packrat/api/app';
import {
  isLocalE2EAuthEnabled,
  localE2EToken,
  makeLocalE2EUser,
} from '@packrat/api/auth/local-e2e';
import { type Env, getEnv, setWorkerEnv } from '@packrat/api/utils/env-validation';

const WELL_KNOWN_AUTH_SERVER_PATH = '/.well-known/oauth-authorization-server';
const WELL_KNOWN_OPENID_CONFIG_PATH = '/.well-known/openid-configuration';
const WELL_KNOWN_AUTH_BASE_PATH = '/api/auth';
const bearerPrefixRegex = /^Bearer\s+/i;

async function loadAuth() {
  const { getAuth } = await import('@packrat/api/auth');
  return getAuth;
}

async function loadOAuthMetadataHandlers() {
  const { oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata } = await import(
    '@better-auth/oauth-provider'
  );
  return { oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata };
}

function enrichEnv(env: Env): Env {
  if (env.OSM_HYPERDRIVE) {
    return { ...env, OSM_DATABASE_URL: env.OSM_HYPERDRIVE.connectionString };
  }
  return env;
}

function envRecord(env: Env): Record<string, unknown> {
  return Object.fromEntries(Object.entries(env));
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

async function handleLocalE2EAuth(input: {
  request: Request;
  env: Env;
}): Promise<Response | undefined> {
  const { request, env } = input;
  if (!isLocalE2EAuthEnabled(env)) return undefined;

  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/api/auth/sign-in/email') {
    const body = (await request.json().catch(() => undefined)) as
      | { email?: string; password?: string }
      | undefined;
    const email = body?.email?.toLowerCase();
    if (email !== env.E2E_TEST_EMAIL?.toLowerCase() || body?.password !== env.E2E_TEST_PASSWORD) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await localE2EToken(env);
    return Response.json(
      {
        redirect: false,
        token,
        user: makeLocalE2EUser(env),
      },
      { headers: { 'set-auth-token': token } },
    );
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/sign-out') {
    const expected = await localE2EToken(env);
    const authorization = request.headers.get('Authorization') ?? '';
    if (authorization.replace(bearerPrefixRegex, '') === expected) {
      return Response.json({ success: true });
    }
  }

  return undefined;
}

export default {
  // biome-ignore lint/complexity/useMaxParams: Cloudflare Worker fetch callbacks receive request, env, and context.
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const e = getEnv(envRecord(enrichEnv(env)));
    setWorkerEnv(envRecord(e));

    const url = new URL(request.url);
    if (request.method === 'GET') {
      const metadataKind = wellKnownMetadataKind(url.pathname);
      if (metadataKind) {
        const getAuth = await loadAuth();
        const auth = await getAuth(e);
        const { oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata } =
          await loadOAuthMetadataHandlers();
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

      const localAuthResponse = await handleLocalE2EAuth({ request, env: e });
      if (localAuthResponse) return addCorsHeaders({ request, response: localAuthResponse });

      const getAuth = await loadAuth();
      const auth = await getAuth(e);
      return addCorsHeaders({ request, response: await auth.handler(request) });
    }

    return Reflect.apply(appBase.fetch, appBase, [request, e, ctx]);
  },

  async queue(_batch: MessageBatch<unknown>): Promise<void> {
    return;
  },
};
