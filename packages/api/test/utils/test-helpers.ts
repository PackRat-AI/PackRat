import { sign } from 'hono/jwt';
import { expect } from 'vitest';
import app from '../../src/index';

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

// Test user data for consistent testing
export const TEST_USER = {
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER' as const,
};

export const TEST_ADMIN = {
  id: 2,
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN' as const,
};

// Helper to create authenticated API requests
export const api = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost/api${path}`, init));

// Internal: shared fetch with auth token for a specific user
const fetchWithUser = async (
  path: string,
  opts: { user: typeof TEST_USER | typeof TEST_ADMIN; init?: RequestInit },
) => {
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

// Helper to create requests with authentication token (as TEST_USER by default)
export const apiWithAuth = async (path: string, init?: RequestInit) =>
  fetchWithUser(path, { user: TEST_USER, init });

// Helper to create requests authenticated as a specific user
export const apiWithAuthAs = async (
  path: string,
  opts: { user: typeof TEST_USER | typeof TEST_ADMIN; init?: RequestInit },
) => fetchWithUser(path, opts);

// Helper to create admin authenticated requests
export const apiWithAdmin = async (path: string, init?: RequestInit) =>
  fetchWithUser(path, { user: TEST_ADMIN, init });

// Helper for admin routes — in tests ADMIN_BYPASS_AUTH=true is set so no auth header is needed
export const apiAdmin = (path: string, init?: RequestInit) =>
  app.fetch(
    new Request(`http://localhost/api/admin${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    }),
  );

/** @deprecated Use apiAdmin instead */
export const apiWithBasicAuth = apiAdmin;

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
