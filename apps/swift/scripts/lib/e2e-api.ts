import { type ChildProcess, spawn } from 'node:child_process';
import { resolve } from 'node:path';

type LocalAPIHandle = {
  baseURL: string;
  stop: () => Promise<void>;
};

const REPO_ROOT = resolve(import.meta.dir, '../../../..');
const API_DIR = resolve(REPO_ROOT, 'packages/api');

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref();
  return controller.signal;
}

async function isHealthy(baseURL: string): Promise<boolean> {
  try {
    const response = await fetch(new URL('/health', baseURL), {
      signal: timeoutSignal(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealthy(input: { baseURL: string; child: ChildProcess }): Promise<void> {
  const { baseURL, child } = input;
  const startedAt = Date.now();
  let exited = false;
  let exitCode: number | null = null;
  let spawnError: Error | undefined;
  child.once('error', (error) => {
    spawnError = error;
  });
  child.once('exit', (code) => {
    exited = true;
    exitCode = code;
  });

  while (Date.now() - startedAt < 120_000) {
    if (spawnError) {
      throw new Error(`Local E2E API failed to start: ${spawnError.message}`);
    }
    if (await isHealthy(baseURL)) return;
    if (exited) {
      throw new Error(
        `Local E2E API exited before becoming healthy (code ${exitCode ?? 'unknown'}).`,
      );
    }
    await Bun.sleep(1000);
  }

  throw new Error(`Local E2E API did not become healthy at ${baseURL}/health within 120s.`);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      resolve();
    }, 5000);
    timeout.unref();
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

export async function ensureLocalE2EAPI(input: {
  packratEnv: string;
  env: NodeJS.ProcessEnv;
}): Promise<LocalAPIHandle> {
  const explicitBaseURL = input.env.E2E_API_BASE_URL;
  const defaultPort = input.packratEnv === 'dev-local' ? '8791' : input.env.PORT || '8787';
  const baseURL = explicitBaseURL?.trim() || `http://localhost:${defaultPort}`;
  const shouldUseLocalAPI = input.packratEnv === 'local' || input.packratEnv === 'dev-local';
  const skipStart = input.env.PACKRAT_SWIFT_E2E_SKIP_API_START === '1';

  if (!shouldUseLocalAPI) {
    return { baseURL, stop: async () => {} };
  }

  if (await isHealthy(baseURL)) {
    console.log(`✓ Local E2E API is healthy at ${baseURL}`);
    return { baseURL, stop: async () => {} };
  }

  if (explicitBaseURL || skipStart) {
    throw new Error(
      `Local E2E API is not healthy at ${baseURL}/health. Start it with \`bun run --cwd packages/api dev:e2e\` or unset E2E_API_BASE_URL so the runner can own it.`,
    );
  }

  console.log(`→ Starting local E2E API at ${baseURL}`);
  const child = spawn('bun', ['run', 'dev:e2e'], {
    cwd: API_DIR,
    env: input.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  try {
    await waitForHealthy({ baseURL, child });
    console.log(`✓ Local E2E API is healthy at ${baseURL}`);
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  return {
    baseURL,
    stop: () => stopChild(child),
  };
}
