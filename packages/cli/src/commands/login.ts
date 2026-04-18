/**
 * `packrat auth login` — authenticate via OAuth 2.1 Device Authorization Grant.
 *
 * Flow:
 *  1. POST /api/oauth/device/code  → get device_code, user_code, verification_uri
 *  2. Print user_code + URL for the user to open in a browser
 *  3. Poll POST /api/oauth/token until authorized or expired
 *  4. Save the access_token to ~/.config/packrat/credentials.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineCommand } from 'citty';
import consola from 'consola';

const DEFAULT_API_URL = 'https://packrat.world';
const CLIENT_ID = 'packrat-cli';

export function getConfigDir(): string {
  return join(homedir(), '.config', 'packrat');
}

export function getCredentialsPath(): string {
  return join(getConfigDir(), 'credentials.json');
}

export interface Credentials {
  accessToken: string;
  apiUrl: string;
  savedAt: string;
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getCredentialsPath(), JSON.stringify(creds, null, 2), 'utf-8');
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await readFile(getCredentialsPath(), 'utf-8');
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default defineCommand({
  meta: {
    name: 'login',
    description: 'Log in to PackRat via Device Authorization (browser-based OAuth)',
  },
  args: {
    'api-url': {
      type: 'string',
      description: `API base URL (default: ${DEFAULT_API_URL})`,
      default: DEFAULT_API_URL,
    },
    scope: {
      type: 'string',
      description: 'Requested OAuth scopes (default: *)',
      default: '*',
    },
  },
  async run({ args }) {
    const apiUrl = String(args['api-url'] ?? DEFAULT_API_URL).replace(/\/$/, '');

    // Step 1: Request device + user codes
    consola.start('Requesting device authorization from PackRat…');

    let deviceData: {
      device_code: string;
      user_code: string;
      verification_uri: string;
      verification_uri_complete?: string;
      expires_in: number;
      interval: number;
    };

    try {
      const res = await fetch(`${apiUrl}/api/oauth/device/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, scope: args.scope }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string; error_description?: string };
        consola.error(`Device code request failed: ${err.error_description ?? err.error}`);
        process.exit(1);
      }
      deviceData = (await res.json()) as typeof deviceData;
    } catch (err) {
      consola.error(`Could not reach PackRat API at ${apiUrl}. Is the URL correct?`);
      consola.error(String(err));
      process.exit(1);
    }

    // Step 2: Show instructions to the user
    consola.box(
      [
        '🎒 PackRat Device Login',
        '',
        `1. Open this URL in your browser:`,
        `   ${deviceData.verification_uri_complete ?? deviceData.verification_uri}`,
        '',
        `2. Enter this code if prompted:`,
        `   ${deviceData.user_code}`,
        '',
        `Code expires in ${Math.floor(deviceData.expires_in / 60)} minutes.`,
      ].join('\n'),
    );

    // Step 3: Poll for authorization
    const pollIntervalMs = (deviceData.interval ?? 5) * 1000;
    const expiresAt = Date.now() + deviceData.expires_in * 1000;

    consola.start('Waiting for authorization…  (Ctrl+C to cancel)');

    while (Date.now() < expiresAt) {
      await sleep(pollIntervalMs);

      let pollRes: Response;
      try {
        pollRes = await fetch(`${apiUrl}/api/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceData.device_code,
            client_id: CLIENT_ID,
          }),
        });
      } catch {
        consola.warn('Network error while polling. Retrying…');
        continue;
      }

      if (pollRes.ok) {
        const tokenData = (await pollRes.json()) as { access_token?: string };
        if (!tokenData.access_token) {
          consola.error('Unexpected response: missing access_token');
          process.exit(1);
        }

        await saveCredentials({
          accessToken: tokenData.access_token,
          apiUrl,
          savedAt: new Date().toISOString(),
        });

        consola.success(`Logged in! Credentials saved to ${getCredentialsPath()}`);
        consola.info(
          'Use the token as:  Authorization: Bearer <token>  or configure your MCP client.',
        );
        return;
      }

      const errBody = (await pollRes.json()) as { error?: string };
      if (errBody.error === 'authorization_pending') {
        // Still waiting — keep polling
        continue;
      }
      if (errBody.error === 'slow_down') {
        // Back off a bit
        await sleep(5000);
        continue;
      }
      if (errBody.error === 'expired_token') {
        consola.error('Authorization timed out. Please run `packrat auth login` again.');
        process.exit(1);
      }
      if (errBody.error === 'access_denied') {
        consola.error('Authorization was denied.');
        process.exit(1);
      }

      consola.error(`Unexpected poll error: ${errBody.error}`);
      process.exit(1);
    }

    consola.error('Authorization timed out. Please run `packrat auth login` again.');
    process.exit(1);
  },
});
