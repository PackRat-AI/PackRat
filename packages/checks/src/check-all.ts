#!/usr/bin/env bun

const checks = [
  { name: 'check:casts', cmd: ['bun', './check-type-casts.ts'] },
  { name: 'check:magic-strings', cmd: ['bun', './check-magic-strings.ts'] },
  { name: 'check:max-params', cmd: ['bun', './check-max-params.ts'] },
];

let hasFailure = false;

for (const check of checks) {
  console.log(`\n▶ Running ${check.name}`);
  const proc = Bun.spawnSync(check.cmd, {
    cwd: import.meta.dir,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if (proc.exitCode !== 0) {
    hasFailure = true;
    console.error(`✖ ${check.name} failed with exit code ${proc.exitCode}`);
  } else {
    console.log(`✔ ${check.name} passed`);
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log('\n✓ All checks passed.');
