/**
 * `~/.packrat/config.json` store.
 *
 * Persists the CLI's session-level state: API base URL, the Better Auth
 * access/refresh token pair, and the admin JWT. Refresh-on-401 is handled by
 * `createApiClient`, which calls back into this module via the AuthHooks in
 * `./client.ts` whenever new tokens arrive.
 *
 * On a fresh machine the config file may not exist; we lazily create the
 * `~/.packrat` directory the first time we need to write.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { nodeEnv } from '@packrat/env/node';
import { z } from 'zod';

const DEFAULT_BASE_URL = 'https://packrat.world';

const CONFIG_DIR = join(homedir(), '.packrat');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export const CliConfigSchema = z.object({
  baseUrl: z.string().url().default(DEFAULT_BASE_URL),
  accessToken: z.string().nullable().default(null),
  refreshToken: z.string().nullable().default(null),
  adminToken: z.string().nullable().default(null),
  adminTokenExpiresAt: z.number().nullable().default(null),
  userEmail: z.string().nullable().default(null),
  userId: z.string().nullable().default(null),
});

export type CliConfig = z.infer<typeof CliConfigSchema>;

const emptyConfig: CliConfig = {
  baseUrl: DEFAULT_BASE_URL,
  accessToken: null,
  refreshToken: null,
  adminToken: null,
  adminTokenExpiresAt: null,
  userEmail: null,
  userId: null,
};

// Persisted state — exactly what's in (or will be in) ~/.packrat/config.json.
let persisted: CliConfig | null = null;

/** Load the persisted config from disk (cached for the lifetime of the process). */
async function loadPersisted(): Promise<CliConfig> {
  if (persisted) return persisted;
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    const parsed = CliConfigSchema.safeParse(JSON.parse(raw));
    persisted = parsed.success ? parsed.data : emptyConfig;
  } catch (e) {
    if (isNotFound(e)) persisted = { ...emptyConfig };
    else throw e;
  }
  return persisted;
}

/**
 * Return the effective runtime config — the persisted state with the
 * `PACKRAT_API_URL` env override layered on top. Callers that need to know
 * the persisted baseUrl (e.g. a future `packrat config show`) should use
 * `loadPersisted` directly; almost everyone wants the effective value.
 */
export async function loadConfig(): Promise<CliConfig> {
  const base = await loadPersisted();
  const envOverride = nodeEnv.PACKRAT_API_URL?.trim();
  // Return a copy so accidental mutation can't leak back into the persisted
  // cache and end up written to disk via saveConfig().
  if (envOverride) return { ...base, baseUrl: envOverride };
  return { ...base };
}

/** Merge a partial update into the config and persist atomically. */
export async function saveConfig(patch: Partial<CliConfig>): Promise<CliConfig> {
  // Merge into the *persisted* state, not the effective config — otherwise a
  // PACKRAT_API_URL env override would get written to disk and stick.
  const current = await loadPersisted();
  const next: CliConfig = { ...current, ...patch };
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  const { rename } = await import('node:fs/promises');
  await rename(tmp, CONFIG_PATH);
  persisted = next;
  return loadConfig();
}

/** Clear all session-level tokens but keep `baseUrl`. */
export async function clearSession(): Promise<void> {
  await saveConfig({
    accessToken: null,
    refreshToken: null,
    adminToken: null,
    adminTokenExpiresAt: null,
    userEmail: null,
    userId: null,
  });
}

/** Path to the config file, exposed for `packrat auth status`. */
export const CONFIG_FILE_PATH = CONFIG_PATH;

function isNotFound(error: unknown): boolean {
  // Node fs errors are Error instances (not plain objects), so isObject()
  // from radash returns false. Check by instance.
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
