// Prints the portless URL for each configured app in THIS worktree, so agents and
// humans can discover service URLs without scraping another process's terminal output.
//
// Discovery rules (learned the hard way — see docs/plans U1 spike):
//   - Start servers with `portless run` / bare `portless` (worktree-aware), then read
//     the injected PORTLESS_URL. NEVER the explicit `portless <name> <cmd>` form — it
//     skips worktree prefixing and the proxy 404s it.
//   - The proxy must run as YOUR user, never under sudo (a root proxy split-brains
//     from user-context route registrations and 404s every backend).
//
// Usage: bun run portless:urls

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

type PortlessConfig = { apps?: Record<string, { name?: string }> };

function configuredNames(): string[] {
  const cfg: PortlessConfig = JSON.parse(
    readFileSync(new URL('../portless.json', import.meta.url), 'utf8'),
  );
  return Object.values(cfg.apps ?? {})
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n));
}

function urlFor(name: string): string {
  try {
    return execSync(`portless get ${name}`, { encoding: 'utf8' }).trim();
  } catch {
    return '(portless not resolvable — is the proxy running as your user?)';
  }
}

const names = configuredNames();
if (names.length === 0) {
  console.log('No apps configured in portless.json');
  process.exit(0);
}

console.log('portless URLs for this worktree:\n');
for (const name of names) {
  console.log(`  ${name.padEnd(8)} ${urlFor(name)}`);
}
console.log('\nStart all apps:   portless');
console.log('Start one app:    cd <app-dir> && portless run <dev command>');
console.log('An app also gets its own URL via the PORTLESS_URL env var at runtime.');
