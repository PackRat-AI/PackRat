// Unit tests for the Sentry API helpers.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const scope = vi.hoisted(() => ({
  setTag: vi.fn(),
  setExtra: vi.fn(),
}));

const sentry = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  withScope: vi.fn((cb: (s: typeof scope) => void) => cb(scope)),
}));

vi.mock('@sentry/cloudflare', () => sentry);

import {
  apiAddBreadcrumb,
  captureApiException,
  clearApiUser,
  setApiUser,
} from '@packrat/api/utils/sentry';

describe('sentry helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('captureApiException', () => {
    it('tags operation + user_id, applies tags/extra, and captures the error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const error = new Error('boom');

      captureApiException({
        error,
        operation: 'pack.create',
        userId: 'u1',
        tags: { feature: 'packs' },
        extra: { packId: 'p1' },
      });

      expect(sentry.withScope).toHaveBeenCalledOnce();
      expect(scope.setTag).toHaveBeenCalledWith('operation', 'pack.create');
      expect(scope.setTag).toHaveBeenCalledWith('user_id', 'u1');
      expect(scope.setTag).toHaveBeenCalledWith('feature', 'packs');
      expect(scope.setExtra).toHaveBeenCalledWith('packId', 'p1');
      expect(sentry.captureException).toHaveBeenCalledWith(error);
      expect(errorSpy).toHaveBeenCalledWith('[sentry][pack.create]', error);

      errorSpy.mockRestore();
    });

    it('omits user_id / tags / extra when they are not provided', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      captureApiException({ error: new Error('x'), operation: 'op' });

      expect(scope.setTag).toHaveBeenCalledWith('operation', 'op');
      expect(scope.setTag).not.toHaveBeenCalledWith('user_id', expect.anything());
      expect(scope.setExtra).not.toHaveBeenCalled();
    });
  });

  describe('apiAddBreadcrumb', () => {
    it('adds a default-type breadcrumb with the provided fields', () => {
      apiAddBreadcrumb({
        category: 'etl',
        message: 'started',
        level: 'info',
        data: { jobId: 'j1' },
      });

      expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
        type: 'default',
        category: 'etl',
        message: 'started',
        level: 'info',
        data: { jobId: 'j1' },
      });
    });
  });

  describe('setApiUser / clearApiUser', () => {
    it('maps role to username when setting the user', () => {
      setApiUser({ id: 'u1', email: 'a@b.co', role: 'ADMIN' });
      expect(sentry.setUser).toHaveBeenCalledWith({
        id: 'u1',
        email: 'a@b.co',
        username: 'ADMIN',
      });
    });

    it('clears the user context', () => {
      clearApiUser();
      expect(sentry.setUser).toHaveBeenCalledWith(null);
    });
  });
});
