/**
 * Eden Treaty client factory for the CLI.
 *
 * Two clients are exposed:
 *
 *  - `user` — authenticated as the Better Auth user whose tokens are stored in
 *    `~/.packrat/config.json`. Uses `createApiClient` so 401s trigger a
 *    transparent refresh, with both new tokens persisted back to config.
 *  - `admin` — authenticated with the short-lived admin JWT minted by
 *    `POST /api/admin/token`. No refresh — the user just runs
 *    `packrat admin login` again when it expires.
 *
 * Both clients share a base URL resolved from config (or `PACKRAT_API_URL`).
 */

import { type ApiClient, createApiClient } from '@packrat/api-client';
import { type CliConfig, loadConfig, saveConfig } from './config';

let cachedUser: ApiClient | null = null;
let cachedAdmin: ApiClient | null = null;

/** Get (and cache) the user-scope Treaty client. */
export async function getUserClient(): Promise<ApiClient> {
  if (cachedUser) return cachedUser;
  const config = await loadConfig();
  cachedUser = createApiClient({
    baseUrl: config.baseUrl,
    auth: {
      getAccessToken: () => loadConfig().then((c) => c.accessToken),
      getRefreshToken: () => loadConfig().then((c) => c.refreshToken),
      onAccessTokenRefreshed: async (token) => {
        await saveConfig({ accessToken: token });
      },
      onRefreshTokenRefreshed: async (token) => {
        await saveConfig({ refreshToken: token });
      },
      onNeedsReauth: async () => {
        await saveConfig({
          accessToken: null,
          refreshToken: null,
          userEmail: null,
          userId: null,
        });
      },
    },
  });
  return cachedUser;
}

/** Get (and cache) the admin-scope Treaty client. */
export async function getAdminClient(): Promise<ApiClient> {
  if (cachedAdmin) return cachedAdmin;
  const config = await loadConfig();
  cachedAdmin = createApiClient({
    baseUrl: config.baseUrl,
    auth: {
      getAccessToken: () => loadConfig().then((c) => c.adminToken),
      // Admin tokens are not refreshable; on 401 we just surface the error.
      getRefreshToken: () => null,
      onAccessTokenRefreshed: () => {},
      onNeedsReauth: async () => {
        await saveConfig({ adminToken: null, adminTokenExpiresAt: null });
      },
    },
  });
  return cachedAdmin;
}

/** Convenience accessor for the base URL (mostly for raw Better Auth calls). */
export async function getBaseUrl(): Promise<string> {
  const config = await loadConfig();
  return config.baseUrl;
}

/** Returns a snapshot of the current config — read-only. */
export async function getConfigSnapshot(): Promise<CliConfig> {
  return loadConfig();
}
