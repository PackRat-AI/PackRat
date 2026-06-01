import { toRecord } from '@packrat/guards';
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
    const response = toRecord(
      await runApi({ promise: client.user.profile.get(), action: 'fetch profile' }),
    );
    const user = toRecord(response.user);
    const config = await loadConfig();
    printSummary({
      data: {
        baseUrl: config.baseUrl,
        userId: config.userId ?? '—',
        email: config.userEmail ?? user.email ?? '—',
        firstName: user.firstName ?? '—',
        lastName: user.lastName ?? '—',
        adminTokenSet: Boolean(config.adminToken),
        configFile: CONFIG_FILE_PATH,
      },
      title: 'PackRat session',
    });
    consola.success('Session looks healthy.');
  },
});
