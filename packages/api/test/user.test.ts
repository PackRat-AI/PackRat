import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestUser } from './utils/db-helpers';
import {
  apiWithAuth,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  TEST_USER,
} from './utils/test-helpers';

let testUserId: number;

beforeAll(async () => {
  // Seed test user
  const user = await seedTestUser({
    id: TEST_USER.id,
    email: TEST_USER.email,
    firstName: TEST_USER.firstName,
    lastName: TEST_USER.lastName,
  });
  testUserId = user.id;
});

describe('User Routes', () => {
  describe('GET /api/user/profile', () => {
    it('should get user profile', async () => {
      const response = await apiWithAuth('/user/profile');

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.user).toMatchObject({
        id: testUserId,
        email: TEST_USER.email,
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
        role: 'USER',
        emailVerified: true,
      });
      expect(result.user.createdAt).toBeDefined();
      expect(result.user.updatedAt).toBeDefined();
    });

    it('should return 401 if not authenticated', async () => {
      const response = await fetch('http://localhost/api/user/profile');

      expectUnauthorized(response);
    });

    it('should include avatar URL if set', async () => {
      // Update user with avatar
      await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          avatarUrl: 'https://example.com/avatar.jpg',
        }),
      });

      const response = await apiWithAuth('/user/profile');

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.user.avatarUrl).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update first name', async () => {
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: 'UpdatedFirst',
        }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.user.firstName).toBe('UpdatedFirst');
      expect(result.message).toContain('Profile updated successfully');
    });

    it('should update last name', async () => {
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          lastName: 'UpdatedLast',
        }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.user.lastName).toBe('UpdatedLast');
    });

    it('should update avatar URL', async () => {
      const newAvatarUrl = 'https://example.com/new-avatar.jpg';
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          avatarUrl: newAvatarUrl,
        }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.user.avatarUrl).toBe(newAvatarUrl);
    });

    it('should clear avatar URL when set to null', async () => {
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          avatarUrl: null,
        }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.user.avatarUrl).toBeNull();
    });

    it('should update multiple fields at once', async () => {
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: 'MultiUpdate',
          lastName: 'TestUser',
          avatarUrl: 'https://example.com/multi.jpg',
        }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.user.firstName).toBe('MultiUpdate');
      expect(result.user.lastName).toBe('TestUser');
      expect(result.user.avatarUrl).toBe('https://example.com/multi.jpg');
    });

    it('should update email and reset email verification', async () => {
      const newEmail = `updated-${Date.now()}@example.com`;
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          email: newEmail,
        }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.user.email).toBe(newEmail.toLowerCase());
      expect(result.user.emailVerified).toBe(false);
      expect(result.message).toContain('verify your new email address');
    });

    it('should normalize email to lowercase', async () => {
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          email: `UPPERCASE-${Date.now()}@EXAMPLE.COM`,
        }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.user.email).toMatch(/^uppercase-.*@example\.com$/);
    });

    it('should return 409 if email is already in use by another user', async () => {
      // Create another user
      const otherUser = await seedTestUser({
        email: `other-${Date.now()}@example.com`,
      });

      // Try to update to the other user's email
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          email: otherUser.email,
        }),
      });

      expect(response.status).toBe(409);
      const error = await response.json();
      expect(error.error).toContain('Email already in use');
      expect(error.code).toBe('EMAIL_CONFLICT');
    });

    it('should allow updating email to same email (no-op)', async () => {
      // First get current profile
      const profileResponse = await apiWithAuth('/user/profile');
      const profile = await profileResponse.json();
      const currentEmail = profile.user.email;

      // Update to same email
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          email: currentEmail,
        }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.user.email).toBe(currentEmail);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await fetch('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName: 'Should Fail' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectUnauthorized(response);
    });

    it('should handle empty update gracefully', async () => {
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it('should update updatedAt timestamp', async () => {
      // Get initial profile
      const initialResponse = await apiWithAuth('/user/profile');
      const initialResult = await initialResponse.json();
      const initialUpdatedAt = new Date(initialResult.user.updatedAt);

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update profile
      const response = await apiWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName: 'TimeStampTest' }),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      const newUpdatedAt = new Date(result.user.updatedAt);

      expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });
  });
});
