import { defineCommand } from 'citty';
import consola from 'consola';
import { getUserClient } from '../../api/client';
import { CONFIG_FILE_PATH, loadConfig } from '../../api/config';
import { requireAuth, runApi } from '../../api/run';
import { printSummary } from '../../shared';

export default defineCommand({
  meta: { name: 'whoami', description: 'Show the current PackRat user and config path.' },
  async run() {
    await requireAuth();
    const client = await getUserClient();
    const profile = await runApi(client.user.profile.get(), { action: 'fetch profile' });
    const config = await loadConfig();
    printSummary(
      {
        baseUrl: config.baseUrl,
        userId: config.userId ?? '—',
        email: config.userEmail ?? '—',
        firstName: (profile as Record<string, unknown>).firstName ?? '—',
        lastName: (profile as Record<string, unknown>).lastName ?? '—',
        adminTokenSet: Boolean(config.adminToken),
        configFile: CONFIG_FILE_PATH,
      },
      'PackRat session',
    );
    consola.success('Session looks healthy.');
  },
});
