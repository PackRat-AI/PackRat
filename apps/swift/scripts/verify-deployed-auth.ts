type AuthPreflightInput = {
  apiBaseURL: string | undefined;
  email: string | undefined;
  password: string | undefined;
};

type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'headers'>>;

type AuthResponseBody = {
  user?: unknown;
  token?: unknown;
  message?: unknown;
  error?: unknown;
  code?: unknown;
};

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Missing deployed auth preflight input: ${name}`);
  return trimmed;
}

function responseMessage(body: AuthResponseBody, status: number): string {
  for (const value of [body.message, body.error, body.code]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return `HTTP ${status}`;
}

async function parseBody(response: Pick<Response, 'json'>): Promise<AuthResponseBody> {
  try {
    const body = await response.json();
    return body && typeof body === 'object' ? (body as AuthResponseBody) : {};
  } catch {
    return {};
  }
}

function signInURL(apiBaseURL: string): URL {
  const normalizedBaseURL = apiBaseURL.endsWith('/') ? apiBaseURL : `${apiBaseURL}/`;
  return new URL('api/auth/sign-in/email', normalizedBaseURL);
}

export async function verifyDeployedAuth(
  input: AuthPreflightInput,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const apiBaseURL = required(input.apiBaseURL, 'E2E_API_BASE_URL');
  const email = required(input.email, 'E2E_EMAIL');
  const password = required(input.password, 'E2E_PASSWORD');

  const response = await fetchImpl(signInURL(apiBaseURL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'packrat://',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await parseBody(response);
  const token = response.headers.get('set-auth-token') ?? body.token;

  if (!response.ok) {
    throw new Error(
      `Swift deployed auth preflight failed: ${responseMessage(body, response.status)}`,
    );
  }

  if (!body.user || !token) {
    throw new Error('Swift deployed auth preflight succeeded without user or session token');
  }
}

if (import.meta.main) {
  try {
    await verifyDeployedAuth({
      apiBaseURL: process.env.E2E_API_BASE_URL,
      email: process.env.E2E_EMAIL,
      password: process.env.E2E_PASSWORD,
    });
    console.log('Swift deployed auth preflight passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
