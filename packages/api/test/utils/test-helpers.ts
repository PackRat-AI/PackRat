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

  // Don't set Content-Type for FormData - let the browser/runtime set it automatically
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init?.headers as Record<string, string>),
  };

  // Only set Content-Type to application/json if body is not FormData
  if (!(init?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return app.fetch(
    new Request(`http://localhost/api${path}`, {
      ...init,
      headers,
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
