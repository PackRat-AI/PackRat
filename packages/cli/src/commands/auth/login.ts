import chalk from 'chalk';
import { defineCommand } from 'citty';
import consola from 'consola';
import { z } from 'zod';
import { getBaseUrl } from '../../api/client';
import { saveConfig } from '../../api/config';

const SignInResponseSchema = z.object({
  session: z.object({ token: z.string() }).optional(),
  user: z.object({ id: z.string(), email: z.string().email().optional() }).optional(),
  // Better Auth may also return a refresh token at top level.
  refreshToken: z.string().optional(),
});

export default defineCommand({
  meta: {
    name: 'login',
    description: 'Sign in to PackRat (email + password). Token stored in ~/.packrat/config.json.',
  },
  args: {
    email: { type: 'string', alias: 'e', description: 'Email address' },
    password: { type: 'string', alias: 'p', description: 'Password (prompted if omitted)' },
  },
  async run({ args }) {
    const email = args.email ?? (await consola.prompt('Email', { type: 'text' }));
    const password =
      args.password ?? (await consola.prompt('Password', { type: 'text', cancel: 'reject' }));

    if (!email || !password) {
      consola.error('Email and password are required.');
      process.exit(1);
    }

    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      consola.error(`Sign-in failed (HTTP ${response.status})`);
      const body = await response.text().catch(() => '');
      if (body) consola.error(chalk.dim(body));
      process.exit(1);
    }

    const parsed = SignInResponseSchema.safeParse(await response.json().catch(() => null));
    const token = parsed.success ? parsed.data.session?.token : undefined;
    const userId = parsed.success ? parsed.data.user?.id : undefined;
    const refreshToken = parsed.success ? parsed.data.refreshToken : undefined;

    if (!token || !userId) {
      consola.error('Sign-in succeeded but session payload was missing token/user.');
      process.exit(1);
    }

    await saveConfig({
      accessToken: token,
      refreshToken: refreshToken ?? null,
      userEmail: email,
      userId,
    });

    consola.success(`Signed in as ${chalk.cyan(email)}.`);
  },
});
