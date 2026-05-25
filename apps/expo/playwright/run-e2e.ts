import { type ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const expoRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(expoRoot, '../..');
const apiRoot = path.join(repoRoot, 'packages/api');
const envLocalPath = path.join(expoRoot, '.env.local');
const envE2ePath = path.join(expoRoot, '.env.e2e');
const envExamplePath = path.join(__dirname, 'e2e.env.example');
const devVarsPath = path.join(repoRoot, '.dev.vars');

type EnvMap = Record<string, string>;

const LINE_BREAK_REGEX = /\r?\n/;

const children: ChildProcess[] = [];
let originalEnvLocal: string | null = null;
let originalEnvLocalExisted = false;
let restored = false;

function parseEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) return {};

  const env: EnvMap = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(LINE_BREAK_REGEX)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function serializeEnv(env: EnvMap): string {
  return `${Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

function spawnLogged({
  args,
  command,
  cwd = repoRoot,
  env,
}: {
  args: string[];
  command: string;
  cwd?: string;
  env: NodeJS.ProcessEnv;
}): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });
  children.push(child);
  return child;
}

function waitForExit(child: ChildProcess, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${name} exited with ${signal ?? code}`));
    });
    child.once('error', reject);
  });
}

function waitForHttp({
  name,
  timeoutMs = 90_000,
  url,
}: {
  name: string;
  timeoutMs?: number;
  url: string;
}): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const check = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        await response.body?.cancel();
        resolve();
      } catch {
        if (Date.now() > deadline) {
          reject(new Error(`${name} did not respond at ${url}`));
          return;
        }
        setTimeout(check, 1_000);
      } finally {
        clearTimeout(timeout);
      }
    };

    void check();
  });
}

function restoreEnvLocal() {
  if (restored) return;
  restored = true;

  if (originalEnvLocalExisted && originalEnvLocal !== null) {
    fs.writeFileSync(envLocalPath, originalEnvLocal);
    return;
  }

  if (fs.existsSync(envLocalPath)) {
    fs.unlinkSync(envLocalPath);
  }
}

function stopChildren() {
  for (const child of children.toReversed()) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
  }
}

async function main() {
  const exampleEnv = parseEnvFile(envExamplePath);
  const e2eEnv = parseEnvFile(envE2ePath);
  const localEnv = parseEnvFile(envLocalPath);
  const devVars = parseEnvFile(devVarsPath);
  const explicitTestEnv: EnvMap = {};
  if (process.env.RUN_AI_E2E) {
    explicitTestEnv.RUN_AI_E2E = process.env.RUN_AI_E2E;
  }
  const merged = { ...process.env, ...exampleEnv, ...e2eEnv, ...explicitTestEnv };

  const apiPort = merged.API_PORT ?? '8797';
  const webPort = merged.WEB_PORT ?? '8097';
  const apiUrl = merged.API_URL ?? `http://localhost:${apiPort}`;
  const baseUrl = merged.BASE_URL ?? `http://localhost:${webPort}`;
  const chromiumPath = merged.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/snap/bin/chromium';

  originalEnvLocalExisted = fs.existsSync(envLocalPath);
  originalEnvLocal = originalEnvLocalExisted ? fs.readFileSync(envLocalPath, 'utf8') : null;

  const expoPublicEnv: EnvMap = {
    ...localEnv,
    EXPO_PUBLIC_API_URL: merged.EXPO_PUBLIC_API_URL ?? apiUrl,
    EXPO_PUBLIC_E2E_GEOCODE: merged.EXPO_PUBLIC_E2E_GEOCODE ?? 'true',
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:
      merged.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
      localEnv.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
      'e2e-dummy',
  };
  fs.writeFileSync(envLocalPath, serializeEnv(expoPublicEnv));

  const sharedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...exampleEnv,
    ...e2eEnv,
    ...explicitTestEnv,
    ...expoPublicEnv,
    API_PORT: apiPort,
    WEB_PORT: webPort,
    API_URL: apiUrl,
    AUTH_ORIGIN: merged.AUTH_ORIGIN ?? baseUrl,
    BASE_URL: baseUrl,
    BROWSER: 'none',
    CI: merged.CI ?? '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_UNSTABLE_WEB_MODAL: '1',
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: chromiumPath,
    CLOUDFLARE_ACCOUNT_ID: merged.CLOUDFLARE_ACCOUNT_ID ?? devVars.CLOUDFLARE_ACCOUNT_ID,
  };

  const api = spawnLogged({
    command: 'bunx',
    cwd: apiRoot,
    args: [
      'wrangler',
      'dev',
      '-e=dev',
      '--port',
      apiPort,
      '--enable-containers=false',
      '--var',
      'ENVIRONMENT:development',
      '--var',
      'BETTER_AUTH_SECRET:local-e2e-better-auth-secret-32-chars',
      '--var',
      `BETTER_AUTH_URL:${apiUrl}`,
      '--var',
      'GOOGLE_CLIENT_SECRET:e2e-google-client-secret',
      '--var',
      'APPLE_CLIENT_ID:world.packrat.e2e',
      '--var',
      'APPLE_PRIVATE_KEY:e2e-apple-private-key',
      '--var',
      'APPLE_KEY_ID:e2e-key',
      '--var',
      'APPLE_TEAM_ID:e2e-team',
    ],
    env: sharedEnv,
  });

  await Promise.race([waitForHttp({ name: 'API', url: apiUrl }), waitForExit(api, 'API')]);

  const web = spawnLogged({
    command: 'bunx',
    cwd: expoRoot,
    args: ['expo', 'start', '--web', '--port', webPort, '--host', 'localhost', '--clear'],
    env: sharedEnv,
  });

  await Promise.race([
    waitForHttp({ name: 'Expo web', url: baseUrl }),
    waitForExit(web, 'Expo web'),
  ]);

  const testArgs = process.argv.slice(2);
  const playwright = spawnLogged({
    command: 'bunx',
    args: [
      'playwright',
      'test',
      '--config',
      'apps/expo/playwright/playwright.config.ts',
      ...testArgs,
    ],
    env: { ...sharedEnv, PW_TEST_HTML_REPORT_OPEN: 'never' },
  });

  await waitForExit(playwright, 'Playwright');
}

process.once('SIGINT', () => {
  stopChildren();
  restoreEnvLocal();
  process.exit(130);
});

process.once('SIGTERM', () => {
  stopChildren();
  restoreEnvLocal();
  process.exit(143);
});

main()
  .finally(() => {
    stopChildren();
    restoreEnvLocal();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
