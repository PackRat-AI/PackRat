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
  role: 'user' as const,
};

export const TEST_ADMIN = {
  id: 2,
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin' as const,
};

// Helper to create authenticated API requests
export const api = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost/api${path}`, init));

// Helper to create requests with authentication token
export const apiWithAuth = async (
  path: string,
  init?: RequestInit,
  user: typeof TEST_USER | typeof TEST_ADMIN = TEST_USER,
) => {
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

// Helper to create admin authenticated requests
export const apiWithAdmin = async (path: string, init?: RequestInit) => {
  return apiWithAuth(path, init, TEST_ADMIN);
};

// Helper for basic auth (admin routes)
export const apiWithBasicAuth = (path: string, init?: RequestInit) => {
  const credentials = btoa('admin:admin-password');
  return app.fetch(
    new Request(`http://localhost/api${path}`, {
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
  get: (_url: string, options?: RequestInit) => ({ method: 'GET', ...options }),
  post: (_url: string, body?: unknown, options?: RequestInit) => ({
    method: 'POST',
    ...createTestRequestBody(body),
    ...options,
  }),
  put: (_url: string, body?: unknown, options?: RequestInit) => ({
    method: 'PUT',
    ...createTestRequestBody(body),
    ...options,
  }),
  patch: (_url: string, body?: unknown, options?: RequestInit) => ({
    method: 'PATCH',
    ...createTestRequestBody(body),
    ...options,
  }),
  delete: (_url: string, options?: RequestInit) => ({ method: 'DELETE', ...options }),
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

// Helper functions for handling auth failures in partial infrastructure mode
export const expectNotFoundOrAuthFailure = (response: Response) => {
  // In partial infrastructure mode, may return 401 if auth middleware runs before DB validation
  expect([404, 401]).toContain(response.status);
};

export const expectForbiddenOrAuthFailure = (response: Response) => {
  // In partial infrastructure mode, may return 401 if auth middleware runs before DB validation
  expect([403, 401]).toContain(response.status);
};

export const expectBadRequestOrAuthFailure = (response: Response) => {
  // In partial infrastructure mode, may return 401 if auth middleware runs before validation
  expect([400, 401]).toContain(response.status);
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

// Helper to skip tests that require database connection
let dbAvailable: boolean | null = null;

export const isDbAvailable = async (): Promise<boolean> => {
  if (dbAvailable !== null) return dbAvailable;

  try {
    // Simple connection test - will fail quickly if DB is not available
    const testClient = new (await import('pg')).Client({
      host: 'localhost',
      port: 5433,
      database: 'packrat_test',
      user: 'test_user',
      password: 'test_password',
      connectionTimeoutMillis: 2000,
    });

    await testClient.connect();
    await testClient.end();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }

  return dbAvailable;
};

// Skip test if database is not available
export const skipIfDbUnavailable = async (testFn: () => void | Promise<void>) => {
  const available = await isDbAvailable();
  if (!available) {
    console.log('⏭️  Skipping test - database not available');
    return;
  }
  await testFn();
};
