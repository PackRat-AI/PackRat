import type { ValidatedEnv } from '@packrat/api/utils/env-validation';

const bearerPrefixRegex = /^Bearer\s+/i;

export type LocalE2EUser = {
  id: string;
  email: string;
  name: string;
  role: 'USER';
  emailVerified: true;
  firstName: string;
  lastName: string;
  avatarUrl: null;
  image: null;
  createdAt: string;
  updatedAt: string;
};

export function isLocalE2EAuthEnabled(env: ValidatedEnv): boolean {
  const dbUrl = env.NEON_DATABASE_URL;
  return (
    (dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost')) &&
    Boolean(env.E2E_TEST_EMAIL) &&
    Boolean(env.E2E_TEST_PASSWORD) &&
    Boolean(env.E2E_TEST_USER_ID)
  );
}

export async function localE2EToken(env: ValidatedEnv): Promise<string> {
  const material = [
    env.BETTER_AUTH_SECRET,
    env.E2E_TEST_EMAIL?.toLowerCase() ?? '',
    env.E2E_TEST_USER_ID ?? '',
  ].join(':');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `e2e-local.${hex}`;
}

export async function getLocalE2EUserFromRequest(
  env: ValidatedEnv,
  request: Request,
): Promise<LocalE2EUser | undefined> {
  if (!isLocalE2EAuthEnabled(env)) return undefined;
  const expected = await localE2EToken(env);
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(bearerPrefixRegex, '');
  if (token !== expected) return undefined;
  return makeLocalE2EUser(env);
}

export function makeLocalE2EUser(env: ValidatedEnv): LocalE2EUser {
  const now = new Date().toISOString();
  return {
    id: env.E2E_TEST_USER_ID ?? '00000000-0000-4000-8000-000000000001',
    email: env.E2E_TEST_EMAIL?.toLowerCase() ?? 'e2e@packrattest.local',
    name: 'E2E Automation',
    role: 'USER',
    emailVerified: true,
    firstName: 'E2E',
    lastName: 'Automation',
    avatarUrl: null,
    image: null,
    createdAt: now,
    updatedAt: now,
  };
}
