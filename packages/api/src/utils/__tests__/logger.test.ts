// Unit tests for the structured logger.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  isInitialized: vi.fn(() => false),
}));

vi.mock('@sentry/cloudflare', () => sentry);

import { logger } from '@packrat/api/utils/logger';

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sentry.addBreadcrumb.mockReset();
    sentry.captureException.mockReset();
    sentry.captureMessage.mockReset();
    sentry.isInitialized.mockReset();
    sentry.isInitialized.mockReturnValue(false);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  function parseLastLine(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
    const calls = spy.mock.calls;
    const last = calls[calls.length - 1];
    if (!last) throw new Error('expected console output but got none');
    const arg = last[0];
    if (typeof arg !== 'string') throw new Error('expected console arg to be a string');
    return JSON.parse(arg);
  }

  describe('info', () => {
    it('emits a JSON line with level=INFO and event', () => {
      logger.info({ event: 'etl.test' });
      expect(logSpy).toHaveBeenCalledOnce();
      const line = parseLastLine(logSpy);
      expect(line.level).toBe('INFO');
      expect(line.event).toBe('etl.test');
      expect(typeof line.ts).toBe('string');
    });

    it('merges ctx fields into the emitted line', () => {
      logger.info({ event: 'etl.test', ctx: { jobId: 'j1', count: 42 } });
      const line = parseLastLine(logSpy);
      expect(line.jobId).toBe('j1');
      expect(line.count).toBe(42);
    });

    it('falls back to a serialization error line when ctx cannot be stringified', () => {
      const ctx: Record<string, unknown> = {};
      ctx.self = ctx;

      logger.info({ event: 'etl.circular', ctx: ctx });

      const line = parseLastLine(logSpy);
      expect(line).toMatchObject({
        level: 'INFO',
        event: 'etl.circular',
        serializationError: true,
      });
    });
  });

  describe('warn', () => {
    it('emits to console.warn with level=WARN', () => {
      logger.warn({ event: 'etl.fallback', ctx: { jobId: 'j2' } });
      expect(warnSpy).toHaveBeenCalledOnce();
      const line = parseLastLine(warnSpy);
      expect(line.level).toBe('WARN');
      expect(line.event).toBe('etl.fallback');
      expect(line.jobId).toBe('j2');
    });
  });

  describe('error', () => {
    it('emits to console.error with level=ERROR', () => {
      logger.error({ event: 'etl.failed', ctx: { jobId: 'j3' } });
      expect(errorSpy).toHaveBeenCalledOnce();
      const line = parseLastLine(errorSpy);
      expect(line.level).toBe('ERROR');
      expect(line.event).toBe('etl.failed');
      expect(line.jobId).toBe('j3');
    });

    it('unpacks an Error attached as ctx.err into errorName / errorMessage / errorStack', () => {
      const err = new Error('boom');
      err.name = 'BoomError';
      logger.error({ event: 'etl.failed', ctx: { jobId: 'j4', err } });
      const line = parseLastLine(errorSpy);
      expect(line.errorName).toBe('BoomError');
      expect(line.errorMessage).toBe('boom');
      expect(typeof line.errorStack).toBe('string');
      // err should not appear as a raw field
      expect(line.err).toBeUndefined();
    });

    it('coerces a non-Error err to a string errorMessage', () => {
      logger.error({ event: 'etl.failed', ctx: { err: 'plain string' } });
      const line = parseLastLine(errorSpy);
      expect(line.errorMessage).toBe('plain string');
      expect(line.errorName).toBeUndefined();
    });

    it('omits err-related fields when no err is provided', () => {
      logger.error({ event: 'etl.failed', ctx: { jobId: 'j5' } });
      const line = parseLastLine(errorSpy);
      expect(line.errorName).toBeUndefined();
      expect(line.errorMessage).toBeUndefined();
      expect(line.errorStack).toBeUndefined();
    });
  });

  describe('sentry forwarding', () => {
    it('adds info breadcrumbs with primitive tags and complex extras', () => {
      sentry.isInitialized.mockReturnValue(true);

      logger.info({
        event: 'etl.started',
        ctx: {
          jobId: 'j1',
          count: 42,
          dryRun: true,
          metadata: { source: 'test' },
        },
      });

      expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'etl.started',
        level: 'info',
        data: {
          event: 'etl.started',
          jobId: 'j1',
          count: '42',
          dryRun: 'true',
          metadata: { source: 'test' },
        },
      });
    });

    it('adds warn breadcrumbs at warning level', () => {
      sentry.isInitialized.mockReturnValue(true);

      logger.warn({ event: 'etl.retry', ctx: { jobId: 'j2' } });

      expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'etl.retry',
        level: 'warning',
        data: {
          event: 'etl.retry',
          jobId: 'j2',
        },
      });
    });

    it('captures error objects with event tags and extras', () => {
      sentry.isInitialized.mockReturnValue(true);
      const err = new Error('boom');

      logger.error({
        event: 'etl.failed',
        ctx: {
          err,
          jobId: 'j3',
          metadata: { source: 'test' },
        },
      });

      expect(sentry.captureException).toHaveBeenCalledWith(err, {
        tags: {
          event: 'etl.failed',
          jobId: 'j3',
        },
        extra: {
          event: 'etl.failed',
          metadata: { source: 'test' },
        },
      });
    });

    it('captures error events without error objects as messages', () => {
      sentry.isInitialized.mockReturnValue(true);

      logger.error({ event: 'etl.failed', ctx: { jobId: 'j4' } });

      expect(sentry.captureMessage).toHaveBeenCalledWith('etl.failed', {
        level: 'error',
        tags: {
          jobId: 'j4',
        },
        extra: {
          event: 'etl.failed',
        },
      });
    });

    it('swallows sentry forwarding failures after console output', () => {
      sentry.isInitialized.mockReturnValue(true);
      sentry.addBreadcrumb.mockImplementation(() => {
        throw new Error('sentry unavailable');
      });

      expect(() => logger.info({ event: 'etl.best-effort' })).not.toThrow();
      expect(logSpy).toHaveBeenCalledOnce();
    });
  });
});
