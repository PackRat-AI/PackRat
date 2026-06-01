// Unit tests for the Sentry helpers (@packrat/api/utils/sentry).

import {
  apiAddBreadcrumb,
  captureApiException,
  clearApiUser,
  isCaptured,
  record,
  setApiUser,
  setRequestId,
} from '@packrat/api/utils/sentry';
import * as Sentry from '@sentry/cloudflare';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared scope stub returned by both withScope and getCurrentScope.
const scope = { setTag: vi.fn(), setExtra: vi.fn() };

vi.mock('@sentry/cloudflare', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  getCurrentScope: vi.fn(() => scope),
  setUser: vi.fn(),
  // startSpan runs the callback and returns its promise (matches the real
  // contract closely enough: the callback owns the try/catch in `record`).
  startSpan: vi.fn((_opts: unknown, cb: () => unknown) => cb()),
  withScope: vi.fn((cb: (s: typeof scope) => void) => cb(scope)),
}));

describe('sentry helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('captureApiException', () => {
    it('reports with operation + userId + tags + extra and logs to console', () => {
      const err = new Error('boom');
      captureApiException({
        error: err,
        operation: 'op.test',
        userId: 'u1',
        tags: { feature: 'x' },
        extra: { relevantId: 7 },
      });
      expect(Sentry.withScope).toHaveBeenCalledOnce();
      expect(scope.setTag).toHaveBeenCalledWith('operation', 'op.test');
      expect(scope.setTag).toHaveBeenCalledWith('user_id', 'u1');
      expect(scope.setTag).toHaveBeenCalledWith('feature', 'x');
      expect(scope.setExtra).toHaveBeenCalledWith('relevantId', 7);
      expect(Sentry.captureException).toHaveBeenCalledWith(err);
      expect(console.error).toHaveBeenCalled();
    });

    it('is idempotent — the same error is reported only once (dedup marker)', () => {
      const err = new Error('dup');
      captureApiException({ error: err, operation: 'first' });
      captureApiException({ error: err, operation: 'second' });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      expect(isCaptured(err)).toBe(true);
    });

    it('captures non-object errors without marking them', () => {
      captureApiException({ error: 'string-error', operation: 'op' });
      expect(Sentry.captureException).toHaveBeenCalledWith('string-error');
      expect(isCaptured('string-error')).toBe(false);
    });
  });

  describe('isCaptured', () => {
    it('is false for a fresh error, undefined, and non-objects', () => {
      expect(isCaptured(new Error('fresh'))).toBe(false);
      expect(isCaptured(undefined)).toBe(false);
      expect(isCaptured('x')).toBe(false);
    });
  });

  describe('record', () => {
    it('runs fn inside a span and returns its result, no capture on success', async () => {
      const result = await record({
        operation: 'span.ok',
        extra: { jobId: '1' },
        fn: async () => 42,
      });
      expect(result).toBe(42);
      expect(Sentry.startSpan).toHaveBeenCalledOnce();
      const [opts] = vi.mocked(Sentry.startSpan).mock.calls[0] ?? [];
      expect(opts).toMatchObject({ name: 'span.ok' });
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('captures with operation context and rethrows on failure', async () => {
      const err = new Error('span boom');
      await expect(
        record({
          operation: 'span.fail',
          extra: { jobId: '2' },
          fn: async () => {
            throw err;
          },
        }),
      ).rejects.toBe(err);
      expect(Sentry.captureException).toHaveBeenCalledWith(err);
      expect(scope.setTag).toHaveBeenCalledWith('operation', 'span.fail');
      expect(isCaptured(err)).toBe(true);
    });

    it('forwards attributes to the span', async () => {
      await record({
        operation: 'span.attr',
        attributes: { jobId: 'abc', count: 3 },
        fn: async () => undefined,
      });
      const [opts] = vi.mocked(Sentry.startSpan).mock.calls.at(-1) ?? [];
      expect(opts).toMatchObject({ attributes: { jobId: 'abc', count: 3 } });
    });
  });

  describe('request/user/breadcrumb helpers', () => {
    it('setRequestId tags the current scope with request_id', () => {
      setRequestId('cf-ray-123');
      expect(Sentry.getCurrentScope).toHaveBeenCalled();
      expect(scope.setTag).toHaveBeenCalledWith('request_id', 'cf-ray-123');
    });

    it('setApiUser maps role to username', () => {
      setApiUser({ id: 'u', email: 'e@x.com', role: 'ADMIN' });
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u', email: 'e@x.com', username: 'ADMIN' });
    });

    it('clearApiUser clears the user', () => {
      clearApiUser();
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });

    it('apiAddBreadcrumb forwards with a default type', () => {
      apiAddBreadcrumb({ category: 'feature', message: 'm', level: 'info', data: { a: 1 } });
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        type: 'default',
        category: 'feature',
        message: 'm',
        level: 'info',
        data: { a: 1 },
      });
    });
  });
});
