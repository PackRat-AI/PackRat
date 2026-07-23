import { nodeEnv } from '@packrat/env/node';
import { isObject, isString } from '@packrat/guards';
import { safeJsonStringify } from '@packrat/utils';

type AuthPreflightInput = {
  apiBaseURL: string | undefined;
  email: string | undefined;
  password: string | undefined;
  fetchImpl?: FetchLike;
};

type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'headers'>>;

type AuthResponseBody = Record<string, unknown> & {
  user?: unknown;
  token?: unknown;
  message?: unknown;
  error?: unknown;
  code?: unknown;
};

function required(input: { value: string | undefined; name: string }): string {
  const { value, name } = input;
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Missing deployed auth preflight input: ${name}`);
  return trimmed;
}

function responseMessage(input: { body: AuthResponseBody; status: number }): string {
  const { body, status } = input;
  for (const value of [body.message, body.error, body.code]) {
    if (isString(value) && value.trim()) return value.trim();
  }
  return `HTTP ${status}`;
}

function authFailureMessage(input: { body: AuthResponseBody; status: number; apiBaseURL: string }) {
  const message = responseMessage(input);
  if (input.status === 401) {
    return `${message}. Check that E2E_TEST_EMAIL/E2E_TEST_PASSWORD match a real QA user on ${input.apiBaseURL}; production is not seeded by Swift CI.`;
  }
  return message;
}

async function parseBody(response: Pick<Response, 'json'>): Promise<AuthResponseBody> {
  try {
    const body = await response.json();
    if (!isObject(body)) return {};
    return {
      user: body.user,
      token: body.token,
      message: body.message,
      error: body.error,
      code: body.code,
    };
  } catch {
    return {};
  }
}

function signInURL(apiBaseURL: string): URL {
  const normalizedBaseURL = apiBaseURL.endsWith('/') ? apiBaseURL : `${apiBaseURL}/`;
  return new URL('api/auth/sign-in/email', normalizedBaseURL);
}

export async function verifyDeployedAuth(input: AuthPreflightInput): Promise<void> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const apiBaseURL = required({ value: input.apiBaseURL, name: 'E2E_API_BASE_URL' });
  const email = required({ value: input.email, name: 'E2E_EMAIL' });
  const password = required({ value: input.password, name: 'E2E_PASSWORD' });

  const response = await fetchImpl(signInURL(apiBaseURL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'packrat://',
    },
    body: safeJsonStringify({ email, password }),
  });
  const body = await parseBody(response);
  const token = response.headers.get('set-auth-token') ?? body.token;

  if (!response.ok) {
    throw new Error(
      `Swift deployed auth preflight failed: ${authFailureMessage({
        body,
        status: response.status,
        apiBaseURL,
      })}`,
    );
  }

  if (!body.user || !token) {
    throw new Error('Swift deployed auth preflight succeeded without user or session token');
  }
}

if (import.meta.main) {
  try {
    await verifyDeployedAuth({
      apiBaseURL: nodeEnv.E2E_API_BASE_URL,
      email: nodeEnv.E2E_EMAIL,
      password: nodeEnv.E2E_PASSWORD,
    });
    console.log('Swift deployed auth preflight passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
