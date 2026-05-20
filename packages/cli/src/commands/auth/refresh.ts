import chalk from 'chalk';
import { defineCommand } from 'citty';
import consola from 'consola';
import { z } from 'zod';
import { getBaseUrl } from '../../api/client';
import { loadConfig, saveConfig } from '../../api/config';

const RefreshResponseSchema = z.object({
  success: z.boolean().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

export default defineCommand({
  meta: {
    name: 'refresh',
    description: 'Force a token refresh using the stored refresh token.',
  },
  async run() {
    const config = await loadConfig();
    if (!config.refreshToken) {
      consola.error(`No refresh token. Run ${chalk.cyan('packrat auth login')} first.`);
      process.exit(1);
    }
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: config.refreshToken }),
    });
    const parsed = RefreshResponseSchema.safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success || !parsed.data.accessToken) {
      consola.error(`Refresh failed (HTTP ${response.status}). Sign in again.`);
      process.exit(1);
    }
    await saveConfig({
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken ?? config.refreshToken,
    });
    consola.success('Refreshed access token.');
  },
});
