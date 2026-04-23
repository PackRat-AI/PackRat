#!/usr/bin/env bun
/**
 * Exposes the local E2E API via ngrok tunnel.
 *
 * Usage:
 *   E2E_API_URL=http://localhost:8787 bun run packages/api/scripts/expose-e2e-api.ts
 *
 * Requires:
 *   - E2E_API_URL: Local API URL to expose
 *   - NGROK_AUTH_TOKEN (optional): ngrok authtoken for persistent URLs
 *
 * Returns:
 *   - Public tunnel URL that can be used to access the local API
 */

import { spawn } from 'node:child_process';

interface TunnelInfo {
  url: string;
  process: any;
}

async function startNgrokTunnel(localUrl: string, authToken?: string): Promise<TunnelInfo> {
  console.log(`🚇 Starting ngrok tunnel for ${localUrl}...`);

  // Parse port from URL
  const url = new URL(localUrl);
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');

  const args = ['http', port, '--log', 'stdout'];

  if (authToken) {
    args.push('--authtoken', authToken);
  }

  const ngrokProcess = spawn('ngrok', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let publicUrl = '';

  // Wait for ngrok to start and get the public URL
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for ngrok to start'));
    }, 30000);

    ngrokProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      process.stdout.write(output);

      // Look for the public URL in the output
      const match = output.match(/https?:\/\/[^\s]+\.ngrok(?:-free)?\.(?:io|app|dev)/);
      if (match && !publicUrl) {
        publicUrl = match[0];
        clearTimeout(timeout);
        resolve();
      }
    });

    ngrokProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data);
    });

    ngrokProcess.on('error', (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ngrokProcess.on('exit', (code: number | null) => {
      if (code !== 0 && code !== null && !publicUrl) {
        clearTimeout(timeout);
        reject(new Error(`ngrok exited with code ${code}`));
      }
    });
  });

  return {
    url: publicUrl,
    process: ngrokProcess,
  };
}

async function main() {
  const localUrl = process.env.E2E_API_URL || 'http://localhost:8787';
  const authToken = process.env.NGROK_AUTH_TOKEN;

  try {
    const tunnel = await startNgrokTunnel(localUrl, authToken);

    // Save tunnel info
    const timestamp = Date.now();
    const tunnelInfoFile = `/tmp/e2e-tunnel-${timestamp}.json`;
    const tunnelInfo = {
      publicUrl: tunnel.url,
      localUrl,
      pid: tunnel.process.pid!,
      timestamp,
    };

    await Bun.write(tunnelInfoFile, JSON.stringify(tunnelInfo, null, 2));

    console.log('');
    console.log('✅ Ngrok tunnel established!');
    console.log('');
    console.log('Tunnel Details:');
    console.log(`  Public URL: ${tunnel.url}`);
    console.log(`  Local URL: ${localUrl}`);
    console.log(`  PID: ${tunnel.process.pid}`);
    console.log('');
    console.log(`Tunnel info saved to: ${tunnelInfoFile}`);
    console.log('');
    console.log('To stop this tunnel:');
    console.log(`  kill ${tunnel.process.pid}`);

    // Output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const output = [
        `tunnel_url=${tunnel.url}`,
        `tunnel_pid=${tunnel.process.pid}`,
        `tunnel_info_file=${tunnelInfoFile}`,
      ].join('\n');

      await Bun.write(process.env.GITHUB_OUTPUT, output + '\n', { flags: 'a' });
    }

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down tunnel...');
      tunnel.process.kill('SIGTERM');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down tunnel...');
      tunnel.process.kill('SIGTERM');
      process.exit(0);
    });

    // Wait for ngrok to exit
    await new Promise((resolve) => {
      tunnel.process.on('exit', resolve);
    });
  } catch (error) {
    console.error('❌ Failed to start ngrok tunnel:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
