/**
 * `packrat auth logout` — remove locally stored OAuth credentials.
 */

import { unlink } from 'node:fs/promises';
import { defineCommand } from 'citty';
import consola from 'consola';
import { getCredentialsPath } from './login';

export default defineCommand({
  meta: {
    name: 'logout',
    description: 'Log out of PackRat by removing stored credentials',
  },
  async run() {
    const credPath = getCredentialsPath();
    try {
      await unlink(credPath);
      consola.success(`Logged out. Credentials removed from ${credPath}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        consola.info('No credentials found — already logged out.');
      } else {
        consola.error(`Failed to remove credentials: ${String(err)}`);
        process.exit(1);
      }
    }
  },
});
