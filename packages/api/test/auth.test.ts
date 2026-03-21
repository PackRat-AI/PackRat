import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import {
  apiWithAuth,
  expectBadRequest,
  expectUnauthorized,
  httpMethods,
  type TEST_USER,
} from './utils/test-helpers';
import { createTestUser } from './utils/user-helpers';

// Helper for auth-specific API calls
const authApi = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost/api/auth${path}`, init));

describe('Auth Routes', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('requires email and password', async () => {
      const res = await authApi('/login', httpMethods.post('', {}));
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error || data.issues).toBeDefined();
    });

    it('requires email field', async () => {
      const res = await authApi('/login', httpMethods.post('', { password: 'test123' }));
      expectBadRequest(res);
    });

    it('requires password field', async () => {
      const res = await authApi('/login', httpMethods.post('', { email: 'test@example.com' }));
      expectBadRequest(res);
    });

    it('returns error for non-existent user', async () => {
      const res = await authApi(
        '/login',
        httpMethods.post('', {
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      );
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error).toBe('Invalid email or password');
    });

    it('returns error for incorrect password', async () => {
      const user = await createTestUser({ email: 'login-test@example.com' });
      const res = await authApi(
        '/login',
        httpMethods.post('', {
          email: user.email,
          password: 'wrong-password',
        }),
      );
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid email or password');
    });

    it('returns tokens and user on successful login', async () => {
      const user = await createTestUser({ email: 'login-success@example.com' });
      const res = await authApi(
        '/login',
        httpMethods.post('', {
          email: user.email,
          password: user.password,
        }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.user.id).toBe(user.id);
      expect(data.user.email).toBe(user.email);
    });

    it('prevents login if email is not verified', async () => {
      const user = await createTestUser({
        email: 'unverified@example.com',
        emailVerified: false,
      });
      const res = await authApi(
        '/login',
        httpMethods.post('', {
          email: user.email,
          password: user.password,
        }),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Please verify your email before logging in');
    });
  });

  describe('POST /auth/register', () => {
    it('requires email and password', async () => {
      const res = await authApi('/register', httpMethods.post('', {}));
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error || data.issues).toBeDefined();
    });

    it('validates email format', async () => {
      const res = await authApi(
        '/register',
        httpMethods.post('', {
          email: 'invalid-email',
          password: 'Password123!',
        }),
      );
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error || data.issues).toBeDefined();
    });

    it('validates password strength', async () => {
      const res = await authApi(
        '/register',
        httpMethods.post('', {
          email: 'test@example.com',
          password: '123', // Too weak
        }),
      );
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error || data.issues).toBeDefined();
    });

    it('accepts valid registration data', async () => {
      const res = await authApi(
        '/register',
        httpMethods.post('', {
          email: 'newuser@example.com',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        }),
      );

      expect(res.status).toBe(200);

      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('registered successfully');
      expect(data.userId).toBeDefined();
    }, 20000);

    it('prevents registration with an existing email', async () => {
      await createTestUser({ email: 'existing@example.com' });
      const res = await authApi(
        '/register',
        httpMethods.post('', {
          email: 'existing@example.com',
          password: 'Password123!',
        }),
      );
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('Email already in use');
    });
  });

  describe('POST /auth/verify-email', () => {
    it('requires email and code', async () => {
      const res = await authApi('/verify-email', httpMethods.post('', {}));
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error || data.issues).toBeDefined();
    });

    it('requires email field', async () => {
      const res = await authApi('/verify-email', httpMethods.post('', { code: '12345' }));
      expectBadRequest(res);
    });

    it('requires code field', async () => {
      const res = await authApi(
        '/verify-email',
        httpMethods.post('', { email: 'test@example.com' }),
      );
      expectBadRequest(res);
    });
  });

  describe('POST /auth/resend-verification', () => {
    it('requires email', async () => {
      const res = await authApi('/resend-verification', httpMethods.post('', {}));
      expectBadRequest(res);
    });

    it('validates email format', async () => {
      const res = await authApi(
        '/resend-verification',
        httpMethods.post('', {
          email: 'invalid-email',
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('requires email', async () => {
      const res = await authApi('/forgot-password', httpMethods.post('', {}));
      expectBadRequest(res);
    });

    it('validates email format', async () => {
      const res = await authApi(
        '/forgot-password',
        httpMethods.post('', {
          email: 'invalid-email',
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('requires email, code, and new password', async () => {
      const res = await authApi('/reset-password', httpMethods.post('', {}));
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error || data.issues).toBeDefined();
    });

    it('validates new password strength', async () => {
      const res = await authApi(
        '/reset-password',
        httpMethods.post('', {
          email: 'test@example.com',
          code: '12345',
          newPassword: '123', // Too weak
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('requires authentication', async () => {
      const res = await authApi('/me');
      expectUnauthorized(res);
    });

    it('returns user data when authenticated', async () => {
      const testUser = await createTestUser();
      const res = await apiWithAuth('/auth/me', undefined, testUser as typeof TEST_USER);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(testUser.id);
      expect(data.user.email).toBe(testUser.email);
    });
  });

  describe('POST /auth/refresh', () => {
    it('requires refresh token', async () => {
      const res = await authApi('/refresh', httpMethods.post('', {}));
      expectBadRequest(res);
    });
  });

  describe('DELETE /auth/', () => {
    it('requires authentication', async () => {
      const res = await authApi('', httpMethods.delete(''));
      expectUnauthorized(res);
    });

    it('deletes the user account when authenticated', async () => {
      const res = await apiWithAuth('/auth', {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify user is gone
      const meRes = await apiWithAuth('/auth/me');
      expect(meRes.status).toBe(401); // Token is no longer valid
    });
  });

  describe('POST /auth/apple', () => {
    it('requires identity token and authorization code', async () => {
      const res = await authApi('/apple', httpMethods.post('', {}));
      expectBadRequest(res);
    });

    it('validates identity token format', async () => {
      const res = await authApi(
        '/apple',
        httpMethods.post('', {
          identityToken: 'invalid-token',
          authorizationCode: 'auth-code',
        }),
      );
      expectBadRequest(res);
    });

    it('handles invalid apple token', async () => {
      const res = await authApi(
        '/apple',
        httpMethods.post('', {
          identityToken: 'invalid-token',
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('POST /auth/google', () => {
    it('requires ID token', async () => {
      const res = await authApi('/google', httpMethods.post('', {}));
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error || data.issues).toBeDefined();
    });

    it('validates Google ID token and returns user', async () => {
      const res = await authApi(
        '/google',
        httpMethods.post('', {
          idToken: 'mock-google-token',
        }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.user.email).toBe('test@gmail.com');
      expect(data.isNewUser).toBe(true); // First time seeing this user
    });

    it('logs in an existing Google user', async () => {
      // First login creates the user
      await authApi(
        '/google',
        httpMethods.post('', {
          idToken: 'mock-google-token',
        }),
      );

      // Second login should find the existing user
      const res = await authApi(
        '/google',
        httpMethods.post('', {
          idToken: 'mock-google-token',
        }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isNewUser).toBe(false);
    });
  });
});
