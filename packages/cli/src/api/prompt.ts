/**
 * Password prompt helper.
 *
 * `consola.prompt({ type: 'text' })` echoes the typed value to the terminal,
 * which leaks credentials over the user's scrollback / clipboard. Consola
 * doesn't expose a password type, so this wraps `node:readline` with raw
 * stdin mode to mask the input.
 *
 * Falls back to a plain prompt when stdin isn't a TTY (CI, piped input).
 */

import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';

export async function promptPassword(label: string): Promise<string> {
  // Non-TTY (CI, piped) — read a line as-is.
  if (!stdin.isTTY || !stdin.setRawMode) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      return await new Promise<string>((resolve) => {
        rl.question(`${label}: `, (answer) => resolve(answer));
      });
    } finally {
      rl.close();
    }
  }

  stdout.write(`${label}: `);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise<string>((resolve) => {
    let password = '';
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (ch === '\r' || ch === '\n' || code === 4) {
          // Enter or Ctrl-D — submit
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(password);
          return;
        }
        if (code === 3) {
          // Ctrl-C — abort
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          process.exit(130);
        }
        if (ch === '' || ch === '\b') {
          // Backspace
          if (password.length > 0) password = password.slice(0, -1);
        } else if (code >= 32) {
          password += ch;
        }
      }
    };
    stdin.on('data', onData);
  });
}
