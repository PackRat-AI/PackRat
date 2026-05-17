import { defineCommand } from 'citty';
import consola from 'consola';
import { getBaseUrl } from '../../api/client';
import { clearSession, loadConfig } from '../../api/config';

export default defineCommand({
  meta: {
    name: 'logout',
    description: 'Clear the local PackRat session. Optionally signs out on the server too.',
  },
  args: {
    'keep-server-session': {
      type: 'boolean',
      description: 'Skip POST /api/auth/sign-out — only clear local tokens',
      default: false,
    },
  },
  async run({ args }) {
    const config = await loadConfig();
    if (!args['keep-server-session'] && config.accessToken) {
      try {
        const baseUrl = await getBaseUrl();
        await fetch(`${baseUrl}/api/auth/sign-out`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.accessToken}` },
        });
      } catch (e) {
        consola.warn(`Server sign-out failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await clearSession();
    consola.success('Signed out.');
  },
});
