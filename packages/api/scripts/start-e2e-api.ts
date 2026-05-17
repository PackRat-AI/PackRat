#!/usr/bin/env bun
/**
 * Starts an isolated API instance for e2e testing.
 *
 * This script:
 * 1. Finds an available port
 * 2. Creates a temporary .dev.vars file with the isolated database URL
 * 3. Starts wrangler dev server on the isolated port
 * 4. Waits for the server to be ready
 * 5. Outputs the API URL and process info
 *
 * Usage:
 *   E2E_DATABASE_URL=<url> bun run packages/api/scripts/start-e2e-api.ts
 *
 * Requires:
 *   - E2E_DATABASE_URL: Connection string for the isolated database
 *
 * Optional:
 *   - E2E_API_PORT: Preferred port (will find next available if taken)
 *   - E2E_VARS_FILE: Path to existing .dev.vars file to extend
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface ProcessInfo {
  pid: number;
  port: number;
  apiUrl: string;
  varsFile: string;
}

async function findAvailablePort(startPort = 8787): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(startPort, () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port is taken, try next one
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

async function createE2EVarsFile(
  databaseUrl: string,
  baseVarsFile?: string,
): Promise<{ path: string; content: string }> {
  const timestamp = Date.now();
  const varsDir = join(process.cwd(), 'packages/api/.e2e-vars');
  await mkdir(varsDir, { recursive: true });

  const varsFilePath = join(varsDir, `vars-${timestamp}.txt`);

  let baseContent = '';
  if (baseVarsFile) {
    try {
      baseContent = await readFile(baseVarsFile, 'utf-8');
      console.log(`📝 Loaded base vars from ${baseVarsFile}`);
    } catch (error) {
      console.log(`⚠️  Could not load base vars file, using minimal config: ${error}`);
    }
  }

  // Override NEON_DATABASE_URL and related vars
  const lines = baseContent.split('\n');
  const filteredLines = lines.filter(
    (line) =>
      !line.startsWith('NEON_DATABASE_URL=') &&
      !line.startsWith('NEON_DATABASE_URL_READONLY=') &&
      line.trim() !== '',
  );

  const varsContent = [
    ...filteredLines,
    '',
    '# E2E Test Database (Ephemeral Branch)',
    `NEON_DATABASE_URL=${databaseUrl}`,
    `NEON_DATABASE_URL_READONLY=${databaseUrl}`,
  ].join('\n');

  await writeFile(varsFilePath, varsContent);
  console.log(`✅ Created E2E vars file: ${varsFilePath}`);

  return { path: varsFilePath, content: varsContent };
}

async function waitForApiReady(apiUrl: string, maxAttempts = 30): Promise<void> {
  console.log(`⏳ Waiting for API to become ready at ${apiUrl}...`);

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const response = await fetch(`${apiUrl}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok) {
        console.log(`✅ API is ready (attempt ${i}/${maxAttempts})`);
        return;
      }
    } catch (error) {
      // Expected while server is starting
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`API did not become ready at ${apiUrl} after ${maxAttempts} attempts`);
}

async function startWranglerDev(
  port: number,
  varsFile: string,
): Promise<{ process: any; apiUrl: string }> {
  console.log(`🚀 Starting wrangler dev on port ${port}...`);

  const apiUrl = `http://127.0.0.1:${port}`;
  const cwd = join(process.cwd(), 'packages/api');

  const wranglerProcess = spawn(
    'bun',
    [
      'run',
      'wrangler',
      'dev',
      '-e=dev',
      '--port',
      port.toString(),
      '--var',
      `NEON_DATABASE_URL:${process.env.E2E_DATABASE_URL}`,
      '--var',
      `NEON_DATABASE_URL_READONLY:${process.env.E2E_DATABASE_URL}`,
    ],
    {
      cwd,
      env: {
        ...process.env,
        // Use the vars file for other env vars
        WRANGLER_LOCAL_DEV_VARS_FILE: varsFile,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    },
  );

  // Capture output for debugging
  wranglerProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString();
    process.stdout.write(output);

    // Look for ready indicator
    if (output.includes('Ready on')) {
      console.log('🎉 Wrangler dev server started');
    }
  });

  wranglerProcess.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(data);
  });

  wranglerProcess.on('error', (error: Error) => {
    console.error('❌ Failed to start wrangler:', error);
  });

  wranglerProcess.on('exit', (code: number | null) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Wrangler exited with code ${code}`);
    }
  });

  // Wait a bit for wrangler to start
  await new Promise((resolve) => setTimeout(resolve, 5000));

  return { process: wranglerProcess, apiUrl };
}

async function main() {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  const preferredPort = process.env.E2E_API_PORT
    ? parseInt(process.env.E2E_API_PORT, 10)
    : 8787;
  const baseVarsFile = process.env.E2E_VARS_FILE;

  if (!databaseUrl) {
    throw new Error('E2E_DATABASE_URL environment variable is required');
  }

  console.log('🚀 Starting isolated E2E API instance...');

  try {
    // Find available port
    const port = await findAvailablePort(preferredPort);
    console.log(`✅ Found available port: ${port}`);

    // Create vars file
    const { path: varsFile } = await createE2EVarsFile(databaseUrl, baseVarsFile);

    // Start wrangler dev
    const { process: wranglerProcess, apiUrl } = await startWranglerDev(port, varsFile);

    // Wait for API to be ready
    await waitForApiReady(apiUrl);

    const processInfo: ProcessInfo = {
      pid: wranglerProcess.pid!,
      port,
      apiUrl,
      varsFile,
    };

    // Save process info for cleanup
    const timestamp = Date.now();
    const processInfoFile = `/tmp/e2e-api-${timestamp}.json`;
    await Bun.write(processInfoFile, JSON.stringify(processInfo, null, 2));

    console.log('');
    console.log('✅ E2E API instance started!');
    console.log('');
    console.log('API Details:');
    console.log(`  URL: ${apiUrl}`);
    console.log(`  PID: ${wranglerProcess.pid}`);
    console.log(`  Port: ${port}`);
    console.log(`  Vars: ${varsFile}`);
    console.log('');
    console.log(`Process info saved to: ${processInfoFile}`);
    console.log('');
    console.log('To stop this API instance:');
    console.log(`  kill ${wranglerProcess.pid}`);
    console.log('  # OR');
    console.log(`  bun run packages/api/scripts/stop-e2e-api.ts ${processInfoFile}`);

    // Output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const output = [
        `api_url=${apiUrl}`,
        `api_port=${port}`,
        `api_pid=${wranglerProcess.pid}`,
        `api_info_file=${processInfoFile}`,
        `vars_file=${varsFile}`,
      ].join('\n');

      await Bun.write(process.env.GITHUB_OUTPUT, output + '\n', { flags: 'a' });
    }

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down...');
      wranglerProcess.kill('SIGTERM');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down...');
      wranglerProcess.kill('SIGTERM');
      process.exit(0);
    });

    // Wait for wrangler to exit
    await new Promise((resolve) => {
      wranglerProcess.on('exit', resolve);
    });
  } catch (error) {
    console.error('❌ Failed to start E2E API instance:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
