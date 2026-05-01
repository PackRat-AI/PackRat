/**
 * Auth route integration tests — migrated to Better Auth.
 *
 * The old routes (/auth/login, /auth/register, /auth/verify-email, etc.)
 * have been replaced by Better Auth endpoints at /api/auth/sign-in/email,
 * /api/auth/sign-up/email, etc. handled directly by the Worker's fetch
 * handler (not the Elysia app). These tests need to be rewritten to call
 * the Worker default.fetch handler or use Better Auth's test helpers.
 */
import { describe, it } from 'vitest';

describe('Auth Routes (Better Auth)', () => {
  describe('POST /api/auth/sign-up/email', () => {
    it.todo('requires email and password');
    it.todo('rejects invalid email');
    it.todo('rejects weak password');
    it.todo('creates user and returns session on success');
    it.todo('rejects duplicate email');
  });

  describe('POST /api/auth/sign-in/email', () => {
    it.todo('requires email and password');
    it.todo('returns error for non-existent user');
    it.todo('returns error for incorrect password');
    it.todo('returns session token on successful login');
  });

  describe('POST /api/auth/sign-out', () => {
    it.todo('invalidates the session token');
    it.todo('returns 200 on success');
  });

  describe('POST /api/auth/forget-password', () => {
    it.todo('sends password reset email');
    it.todo('returns 200 even for non-existent email (no user enumeration)');
  });

  describe('POST /api/auth/reset-password', () => {
    it.todo('resets password with valid token');
    it.todo('rejects expired token');
    it.todo('rejects invalid token');
  });

  describe('POST /api/auth/verify-email', () => {
    it.todo('verifies email with valid token');
    it.todo('rejects invalid token');
  });
});
