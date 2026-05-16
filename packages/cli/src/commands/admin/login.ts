import chalk from 'chalk';
import { defineCommand } from 'citty';
import consola from 'consola';
import { z } from 'zod';
import { getBaseUrl } from '../../api/client';
import { saveConfig } from '../../api/config';

const TokenResponseSchema = z.object({
  token: z.string(),
  expiresIn: z.number(),
});

export default defineCommand({
  meta: {
    name: 'login',
    description: 'Exchange admin Basic credentials for a short-lived admin JWT (60 min).',
  },
  args: {
    username: { type: 'string', alias: 'u', description: 'Admin username' },
    password: { type: 'string', alias: 'p', description: 'Admin password (prompted if omitted)' },
  },
  async run({ args }) {
    const username = args.username ?? (await consola.prompt('Admin username', { type: 'text' }));
    const password =
      args.password ?? (await consola.prompt('Admin password', { type: 'text', cancel: 'reject' }));

    const baseUrl = await getBaseUrl();
    const basic = Buffer.from(`${username}:${password}`).toString('base64');
    const response = await fetch(`${baseUrl}/api/admin/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      consola.error(`Admin login failed (HTTP ${response.status}).`);
      if (body) consola.error(chalk.dim(body));
      process.exit(1);
    }

    const parsed = TokenResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      consola.error('Token endpoint returned an unexpected payload.');
      process.exit(1);
    }
    const expiresAt = Date.now() + parsed.data.expiresIn * 1000;
    await saveConfig({ adminToken: parsed.data.token, adminTokenExpiresAt: expiresAt });
    consola.success(
      `Admin token stored (valid for ${Math.round(parsed.data.expiresIn / 60)} min).`,
    );
  },
});
