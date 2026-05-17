#!/usr/bin/env bun
/**
 * Stops an isolated E2E API instance.
 *
 * Usage:
 *   bun run packages/api/scripts/stop-e2e-api.ts /tmp/e2e-api-1234567890.json
 *   # OR
 *   E2E_API_PID=12345 bun run packages/api/scripts/stop-e2e-api.ts
 */

import { unlink } from 'node:fs/promises';

interface ProcessInfo {
  pid: number;
  port: number;
  apiUrl: string;
  varsFile: string;
}

function killProcess(pid: number): boolean {
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`✅ Sent SIGTERM to process ${pid}`);

    // Wait a bit and check if it's still running
    setTimeout(() => {
      try {
        process.kill(pid, 0); // Check if process exists
        console.log(`⚠️  Process ${pid} still running, sending SIGKILL`);
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process is dead, which is good
      }
    }, 5000);

    return true;
  } catch (error: any) {
    if (error.code === 'ESRCH') {
      console.log(`⚠️  Process ${pid} not found (may have already exited)`);
      return true;
    }
    console.error(`❌ Failed to kill process ${pid}:`, error);
    return false;
  }
}

async function main() {
  // Try to get process info from file argument first
  const processInfoFile = process.argv[2];
  let processInfo: ProcessInfo | null = null;

  if (processInfoFile) {
    try {
      const file = Bun.file(processInfoFile);
      const content = await file.text();
      processInfo = JSON.parse(content);
      console.log(`📄 Loaded process info from ${processInfoFile}`);
    } catch (error) {
      console.error(`⚠️  Failed to read process info file: ${error}`);
    }
  }

  // Fallback to environment variable
  if (!processInfo) {
    const pid = process.env.E2E_API_PID;

    if (!pid) {
      throw new Error(
        'Either provide a process info JSON file as argument, or set E2E_API_PID environment variable',
      );
    }

    processInfo = {
      pid: parseInt(pid, 10),
      port: 0,
      apiUrl: '',
      varsFile: '',
    };
    console.log(`🔧 Using environment variable for cleanup`);
  }

  console.log('🛑 Stopping E2E API instance...');
  console.log(`  PID: ${processInfo.pid}`);
  console.log(`  URL: ${processInfo.apiUrl}`);

  try {
    // Kill the process
    const killed = killProcess(processInfo.pid);

    if (!killed) {
      console.error(`❌ Failed to stop process ${processInfo.pid}`);
      process.exit(1);
    }

    // Delete the vars file if it exists
    if (processInfo.varsFile) {
      try {
        await unlink(processInfo.varsFile);
        console.log(`✅ Deleted vars file: ${processInfo.varsFile}`);
      } catch (error) {
        console.log(`⚠️  Could not delete vars file: ${error}`);
      }
    }

    // Delete the process info file
    if (processInfoFile) {
      try {
        await unlink(processInfoFile);
        console.log(`✅ Deleted process info file: ${processInfoFile}`);
      } catch (error) {
        console.log(`⚠️  Could not delete process info file: ${error}`);
      }
    }

    console.log('');
    console.log('✅ E2E API cleanup complete!');
  } catch (error) {
    console.error('❌ Failed to stop E2E API:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
