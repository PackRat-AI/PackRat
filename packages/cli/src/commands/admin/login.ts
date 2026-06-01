import { defineCommand } from 'citty';
import consola from 'consola';
import { getUserClient } from '../../api/client';
import { saveConfig } from '../../api/config';
import { promptPassword } from '../../api/prompt';
import { runApi } from '../../api/run';

export default defineCommand({
  meta: {
    name: 'login',
    description: 'Exchange admin credentials for a short-lived admin JWT (60 min).',
  },
  args: {
    username: { type: 'string', alias: 'u', description: 'Admin username' },
    password: { type: 'string', alias: 'p', description: 'Admin password (prompted if omitted)' },
  },
  async run({ args }) {
    const username = args.username ?? (await consola.prompt('Admin username', { type: 'text' }));
    const password = args.password ?? (await promptPassword('Admin password'));

    // The user-scope Treaty client is fine here — /admin/login is the
    // credential-exchange route and ignores any Bearer header.
    const client = await getUserClient();
    const { token, expiresIn } = await runApi({
      promise: client.admin.login.post({ username, password }),
      action: 'admin login',
    });

    const expiresAt = Date.now() + expiresIn * 1000;
    await saveConfig({ adminToken: token, adminTokenExpiresAt: expiresAt });
    consola.success(`Admin token stored (valid for ${Math.round(expiresIn / 60)} min).`);
  },
});
