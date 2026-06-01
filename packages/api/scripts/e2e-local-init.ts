import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeEnv } from '@packrat/env/node';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, '..');
const repoRoot = resolve(apiDir, '../..');

const e2eDbUrl = nodeEnv.E2E_DB_URL ?? 'postgres://e2e_user:e2e_pass@localhost:5435/packrat_e2e';
const e2eApiUrl = nodeEnv.E2E_API_URL ?? `http://localhost:${nodeEnv.PORT ?? '8787'}`;
const e2eExpoPublicApiUrl = nodeEnv.E2E_EXPO_PUBLIC_API_URL ?? e2eApiUrl;
const disableLogBox = nodeEnv.EXPO_PUBLIC_DISABLE_LOGBOX ?? 'true';
const out = join(apiDir, '.dev.vars.e2e');

const candidates = [
  join(apiDir, '.dev.vars'),
  join(repoRoot, '../development/packages/api/.dev.vars'),
];

const source = candidates.find((candidate) => Bun.file(candidate).exists());
if (!source) {
  console.error('Error: Could not find a base .dev.vars file.');
  console.error('  Checked:');
  for (const candidate of candidates) {
    console.error(`    ${candidate}`);
  }
  console.error('');
  console.error('Copy .dev.vars.e2e.example to .dev.vars.e2e and fill in your secrets manually.');
  process.exit(1);
}

console.log(`Using base vars from: ${source}`);

const sourceText = await Bun.file(source).text();
const lines = sourceText.replaceAll('\r\n', '\n').split('\n');
const trailingNewline = sourceText.endsWith('\n');

const outputLines = lines.map((line) => {
  if (line.startsWith('NEON_DATABASE_URL=')) return `NEON_DATABASE_URL=${e2eDbUrl}`;
  if (line.startsWith('NEON_DATABASE_URL_READONLY='))
    return `NEON_DATABASE_URL_READONLY=${e2eDbUrl}`;
  if (line.startsWith('EXPO_PUBLIC_API_URL=')) return `EXPO_PUBLIC_API_URL=${e2eExpoPublicApiUrl}`;
  if (line.startsWith('BETTER_AUTH_URL=')) return `BETTER_AUTH_URL=${e2eApiUrl}`;
  return line;
});

if (!outputLines.some((line) => line.startsWith('E2E_TEST_EMAIL='))) {
  outputLines.push('', `E2E_TEST_EMAIL=${nodeEnv.E2E_TEST_EMAIL ?? 'e2e@packrattest.local'}`);
}
if (!outputLines.some((line) => line.startsWith('E2E_TEST_PASSWORD='))) {
  outputLines.push(`E2E_TEST_PASSWORD=${nodeEnv.E2E_TEST_PASSWORD ?? 'E2eTestPass123!'}`);
}
if (!outputLines.some((line) => line.startsWith('BETTER_AUTH_URL='))) {
  outputLines.push(`BETTER_AUTH_URL=${e2eApiUrl}`);
}
if (!outputLines.some((line) => line.startsWith('EXPO_PUBLIC_DISABLE_LOGBOX='))) {
  outputLines.push(`EXPO_PUBLIC_DISABLE_LOGBOX=${disableLogBox}`);
}

await Bun.write(out, `${outputLines.join('\n')}${trailingNewline ? '\n' : ''}`);

console.log(`Generated: ${out}`);
console.log('');
console.log('Next steps:');
console.log(`  1. Review ${out} and confirm the values look correct.`);
console.log('  2. Run: scripts/e2e-local-start.sh');
