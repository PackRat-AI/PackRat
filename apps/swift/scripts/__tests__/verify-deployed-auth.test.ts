import { describe, expect, it, vi } from 'vitest';
import { verifyDeployedAuth } from '../verify-deployed-auth';

function response(input: {
  ok: boolean;
  status?: number;
  body?: unknown;
  tokenHeader?: string;
  jsonThrows?: boolean;
}) {
  return {
    ok: input.ok,
    status: input.status ?? (input.ok ? 200 : 401),
    headers: new Headers(input.tokenHeader ? { 'set-auth-token': input.tokenHeader } : {}),
    json: async () => {
      if (input.jsonThrows) throw new Error('not json');
      return input.body ?? {};
    },
  };
}

describe('verifyDeployedAuth', () => {
  it('posts Better Auth credentials to the deployed API', async () => {
    const fetchImpl = vi.fn(async () =>
      response({
        ok: true,
        body: { user: { id: 'user-1' } },
        tokenHeader: 'session-token',
      }),
    );

    await verifyDeployedAuth({
      apiBaseURL: 'https://api.example.test/base-path',
      email: 'tester@example.com',
      password: 'correct horse battery staple',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://api.example.test/base-path/api/auth/sign-in/email');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Origin: 'packrat://',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'tester@example.com',
      password: 'correct horse battery staple',
    });
  });

  it('accepts a token in the JSON body when the auth header is absent', async () => {
    await expect(
      verifyDeployedAuth({
        apiBaseURL: 'https://api.example.test',
        email: 'tester@example.com',
        password: 'password',
        fetchImpl: async () =>
          response({ ok: true, body: { user: { id: 'user-1' }, token: 'body-token' } }),
      }),
    ).resolves.toBeUndefined();
  });

  it('reports the Better Auth message for bad credentials', async () => {
    await expect(
      verifyDeployedAuth({
        apiBaseURL: 'https://api.example.test',
        email: 'tester@example.com',
        password: 'wrong',
        fetchImpl: async () =>
          response({
            ok: false,
            status: 401,
            body: { message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' },
          }),
      }),
    ).rejects.toThrow(
      'Swift deployed auth preflight failed: Invalid email or password. Check that E2E_TEST_EMAIL/E2E_TEST_PASSWORD match a real QA user on https://api.example.test; production is not seeded by Swift CI.',
    );
  });

  it('falls back to status when the error body is not JSON', async () => {
    await expect(
      verifyDeployedAuth({
        apiBaseURL: 'https://api.example.test',
        email: 'tester@example.com',
        password: 'wrong',
        fetchImpl: async () => response({ ok: false, status: 503, jsonThrows: true }),
      }),
    ).rejects.toThrow('Swift deployed auth preflight failed: HTTP 503');
  });

  it('fails when the deployed response lacks a user or session token', async () => {
    await expect(
      verifyDeployedAuth({
        apiBaseURL: 'https://api.example.test',
        email: 'tester@example.com',
        password: 'password',
        fetchImpl: async () => response({ ok: true, body: { user: { id: 'user-1' } } }),
      }),
    ).rejects.toThrow('Swift deployed auth preflight succeeded without user or session token');
  });

  it('fails before network calls when inputs are missing', async () => {
    const fetchImpl = vi.fn();

    await expect(
      verifyDeployedAuth({
        apiBaseURL: 'https://api.example.test',
        email: '',
        password: 'password',
        fetchImpl,
      }),
    ).rejects.toThrow('Missing deployed auth preflight input: E2E_EMAIL');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
