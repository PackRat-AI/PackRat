// Non-privileged portless readiness check, run from postinstall.
//
// Stays silent unless the dev has opted into portless (the `portless` binary is
// present) AND the local CA has not been generated/trusted yet. Never fails the
// install — it only prints a one-line reminder.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function has(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore', shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

try {
  // Only relevant if the dev is actually using portless.
  if (!has('portless')) {
    process.exit(0);
  }

  // ~/.portless/ca.pem appears once `portless trust` (or a first proxy start) has run.
  const caReady = existsSync(join(homedir(), '.portless', 'ca.pem'));

  if (!caReady) {
    console.warn('\n⚠️  portless is installed but its local CA is not set up yet.');
    console.warn('   One-time fix: bun run portless:setup');
    console.warn(
      '   Then start dev with: portless  (user-owned proxy — never run it under sudo)\n',
    );
  }
} catch {
  // Best-effort only — never block install.
}
