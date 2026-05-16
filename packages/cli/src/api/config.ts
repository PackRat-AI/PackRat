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

let cached: CliConfig | null = null;

/** Read the config from disk (cached for the lifetime of the process). */
export async function loadConfig(): Promise<CliConfig> {
  if (cached) return cached;
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    const parsed = CliConfigSchema.safeParse(JSON.parse(raw));
    cached = parsed.success ? parsed.data : emptyConfig;
  } catch (e) {
    if (isNotFound(e)) cached = { ...emptyConfig };
    else throw e;
  }
  // PACKRAT_API_URL env override always wins. Useful for local dev (e.g.
  // pointing the CLI at `http://localhost:8787`).
  const envOverride = process.env.PACKRAT_API_URL?.trim();
  if (envOverride) cached.baseUrl = envOverride;
  return cached;
}

/** Merge a partial update into the config and persist atomically. */
export async function saveConfig(patch: Partial<CliConfig>): Promise<CliConfig> {
  const current = await loadConfig();
  const next: CliConfig = { ...current, ...patch };
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  // Write to a tmp file then rename so partial writes can't corrupt config.
  const tmp = `${CONFIG_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  const { rename } = await import('node:fs/promises');
  await rename(tmp, CONFIG_PATH);
  cached = next;
  return next;
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
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT',
  );
}
