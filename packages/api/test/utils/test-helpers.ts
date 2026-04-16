import { SignJWT } from 'jose';
import { expect } from 'vitest';
import { app } from '../../src/index';

const secret = new TextEncoder().encode('secret');

async function sign(payload: Record<string, unknown>, _secret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

// Extend expect with custom matchers
expect.extend({
  toBeOneOf(received: unknown, expected: unknown[]) {
    const pass = expected.includes(received);
    return {
      message: () => `expected ${received} to be one of [${expected.join(', ')}]`,
      pass,
    };
  },
});

type AuthSubject = { id: number; role: 'USER' | 'ADMIN' };

// Current test user for JWT signing. Set by seedTestUser (#2180) — no hardcoded id.
let currentTestUser: AuthSubject | null = null;
let currentTestAdmin: AuthSubject | null = null;

export const setCurrentTestUser = (user: AuthSubject) => {
  currentTestUser = user;
};

export const setCurrentTestAdmin = (user: AuthSubject) => {
  currentTestAdmin = user;
};

export const clearCurrentTestUsers = () => {
  currentTestUser = null;
  currentTestAdmin = null;
};

// Helper to create authenticated API requests
export const api = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost/api${path}`, init));

// Internal: shared fetch with auth token for a specific user
const fetchWithUser = async (path: string, opts: { user: AuthSubject; init?: RequestInit }) => {
  const { user, init } = opts;
  const token = await sign({ userId: user.id, role: user.role }, 'secret');
  return app.fetch(
    new Request(`http://localhost/api${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    }),
  );
};

// Synthetic JWT subject for tests that sign a JWT but never touch users in DB
// (e.g. catalog, guides, upload). Tests that need the user to exist in DB must
// call seedTestUser() in beforeEach, which sets currentTestUser.
const SYNTHETIC_USER: AuthSubject = { id: 0, role: 'USER' };
const SYNTHETIC_ADMIN: AuthSubject = { id: 0, role: 'ADMIN' };

export const apiWithAuth = async (path: string, init?: RequestInit) =>
  fetchWithUser(path, { user: currentTestUser ?? SYNTHETIC_USER, init });

export const apiWithAuthAs = async (
  path: string,
  opts: { user: AuthSubject; init?: RequestInit },
) => fetchWithUser(path, opts);

export const apiWithAdmin = async (path: string, init?: RequestInit) =>
  fetchWithUser(path, { user: currentTestAdmin ?? SYNTHETIC_ADMIN, init });

// Helper for admin routes (basic auth)
export const apiWithBasicAuth = (path: string, init?: RequestInit) => {
  const credentials = btoa('admin:admin-password');
  return app.fetch(
    new Request(`http://localhost/api/admin${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    }),
  );
};

// Common request bodies for testing
export const createTestRequestBody = (data: unknown) => ({
  body: JSON.stringify(data),
  headers: { 'Content-Type': 'application/json' },
});

// Helper to test common HTTP methods
export const httpMethods = {
  get: (options?: RequestInit) => ({ method: 'GET', ...options }),
  post: (body?: unknown, options?: RequestInit) => ({
    method: 'POST',
    ...createTestRequestBody(body),
    ...options,
  }),
  put: (body?: unknown, options?: RequestInit) => ({
    method: 'PUT',
    ...createTestRequestBody(body),
    ...options,
  }),
  patch: (body?: unknown, options?: RequestInit) => ({
    method: 'PATCH',
    ...createTestRequestBody(body),
    ...options,
  }),
  delete: (options?: RequestInit) => ({ method: 'DELETE', ...options }),
};

// Common test scenarios
export const expectUnauthorized = (response: Response) => {
  expect(response.status).toBe(401);
};

export const expectBadRequest = (response: Response) => {
  expect(response.status).toBe(400);
};

export const expectNotFound = (response: Response) => {
  expect(response.status).toBe(404);
};

export const expectSuccess = (response: Response) => {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
};

// Helper to test response JSON structure
export const expectJsonResponse = async (response: Response, expectedFields?: string[]) => {
  expectSuccess(response);
  const data = await response.json();
  expect(data).toBeDefined();

  if (expectedFields) {
    for (const field of expectedFields) {
      expect(data).toHaveProperty(field);
    }
  }

  return data;
};

// Helper to create API request with API key authentication
export const apiWithApiKey = (path: string, init?: RequestInit) => {
  return app.fetch(
    new Request(`http://localhost/api${path}`, {
      ...init,
      headers: {
        'X-API-Key': 'test-api-key',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    }),
  );
};
