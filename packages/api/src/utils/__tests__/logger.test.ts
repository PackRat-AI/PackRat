// Unit tests for the structured logger.

import { logger } from '@packrat/api/utils/logger';
import * as Sentry from '@sentry/cloudflare';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Default to "not initialized" so the base console-only tests below match the
// real unit-test runtime. The Sentry-forwarding block flips it to true.
vi.mock('@sentry/cloudflare', () => ({
  isInitialized: vi.fn(() => false),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
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

  describe('Sentry forwarding (when initialized)', () => {
    beforeEach(() => {
      vi.mocked(Sentry.isInitialized).mockReturnValue(true);
      vi.mocked(Sentry.captureException).mockClear();
      vi.mocked(Sentry.captureMessage).mockClear();
      vi.mocked(Sentry.addBreadcrumb).mockClear();
    });

    afterEach(() => {
      vi.mocked(Sentry.isInitialized).mockReturnValue(false);
    });

    it('forwards ERROR with ctx.err to captureException, splitting scalar tags from object extras', () => {
      const err = new Error('boom');
      logger.error({
        event: 'etl.failed',
        ctx: { jobId: 'j6', count: 3, ok: true, meta: { nested: 1 }, err },
      });
      expect(Sentry.captureException).toHaveBeenCalledOnce();
      const [captured, rawOpts] = vi.mocked(Sentry.captureException).mock.calls[0] ?? [];
      const opts = rawOpts as
        | { tags?: Record<string, string>; extra?: Record<string, unknown> }
        | undefined;
      expect(captured).toBe(err);
      expect(opts?.tags).toMatchObject({
        event: 'etl.failed',
        jobId: 'j6',
        count: '3',
        ok: 'true',
      });
      expect(opts?.extra).toMatchObject({ event: 'etl.failed', meta: { nested: 1 } });
    });

    it('forwards ERROR without ctx.err to captureMessage at error level', () => {
      logger.error({ event: 'etl.failed', ctx: { jobId: 'j7' } });
      expect(Sentry.captureMessage).toHaveBeenCalledOnce();
      const [event, rawOpts] = vi.mocked(Sentry.captureMessage).mock.calls[0] ?? [];
      const opts = rawOpts as { level?: string; tags?: Record<string, string> } | undefined;
      expect(event).toBe('etl.failed');
      expect(opts?.level).toBe('error');
      expect(opts?.tags).toMatchObject({ jobId: 'j7' });
    });

    it('forwards WARN to an addBreadcrumb with warning level', () => {
      logger.warn({ event: 'etl.fallback', ctx: { jobId: 'j8' } });
      expect(Sentry.addBreadcrumb).toHaveBeenCalledOnce();
      const [crumb] = vi.mocked(Sentry.addBreadcrumb).mock.calls[0] ?? [];
      expect(crumb?.category).toBe('etl.fallback');
      expect(crumb?.level).toBe('warning');
      expect(crumb?.data).toMatchObject({ jobId: 'j8' });
    });

    it('forwards INFO to an addBreadcrumb with info level', () => {
      logger.info({ event: 'etl.start', ctx: { jobId: 'j9' } });
      expect(Sentry.addBreadcrumb).toHaveBeenCalledOnce();
      const [crumb] = vi.mocked(Sentry.addBreadcrumb).mock.calls[0] ?? [];
      expect(crumb?.level).toBe('info');
    });

    it('swallows Sentry errors so logging never throws', () => {
      vi.mocked(Sentry.addBreadcrumb).mockImplementationOnce(() => {
        throw new Error('sentry down');
      });
      expect(() => logger.info({ event: 'etl.start', ctx: { jobId: 'j10' } })).not.toThrow();
    });
  });
});
