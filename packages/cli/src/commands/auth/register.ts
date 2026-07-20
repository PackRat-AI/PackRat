import { safeJsonStringify } from '@packrat/utils';
import chalk from 'chalk';
import { defineCommand } from 'citty';
import consola from 'consola';
import { z } from 'zod';
import { getBaseUrl } from '../../api/client';
import { saveConfig } from '../../api/config';
import { promptPassword } from '../../api/prompt';

const SignUpResponseSchema = z.object({
  session: z.object({ token: z.string() }).optional(),
  user: z.object({ id: z.string(), email: z.string().email().optional() }).optional(),
  refreshToken: z.string().optional(),
});

export default defineCommand({
  meta: {
    name: 'register',
    description: 'Create a new PackRat account (Better Auth email + password).',
  },
  args: {
    email: { type: 'string', alias: 'e', description: 'Email address' },
    password: { type: 'string', alias: 'p', description: 'Password (prompted if omitted)' },
    name: { type: 'string', alias: 'n', description: 'Display name' },
  },
  async run({ args }) {
    const email = args.email ?? (await consola.prompt('Email', { type: 'text' }));
    const name = args.name ?? (await consola.prompt('Name', { type: 'text' }));
    const password = args.password ?? (await promptPassword('Password'));

    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeJsonStringify({ email, password, name }),
    });

    if (!response.ok) {
      consola.error(`Sign-up failed (HTTP ${response.status})`);
      const body = await response.text().catch(() => '');
      if (body) consola.error(chalk.dim(body));
      process.exit(1);
    }

    const parsed = SignUpResponseSchema.safeParse(await response.json().catch(() => null));
    const token = parsed.success ? parsed.data.session?.token : undefined;
    const userId = parsed.success ? parsed.data.user?.id : undefined;
    const refreshToken = parsed.success ? parsed.data.refreshToken : undefined;

    if (!token || !userId) {
      consola.success('Account created. Run `packrat auth login` to sign in.');
      return;
    }

    await saveConfig({
      accessToken: token,
      refreshToken: refreshToken ?? null,
      userEmail: email,
      userId,
    });
    consola.success(`Account created and signed in as ${chalk.cyan(email)}.`);
  },
});
