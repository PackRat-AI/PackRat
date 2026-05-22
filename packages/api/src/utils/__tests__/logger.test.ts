// Unit tests for the structured logger.

import { logger } from '@packrat/api/utils/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      logger.info('etl.test');
      expect(logSpy).toHaveBeenCalledOnce();
      const line = parseLastLine(logSpy);
      expect(line.level).toBe('INFO');
      expect(line.event).toBe('etl.test');
      expect(typeof line.ts).toBe('string');
    });

    it('merges ctx fields into the emitted line', () => {
      logger.info('etl.test', { jobId: 'j1', count: 42 });
      const line = parseLastLine(logSpy);
      expect(line.jobId).toBe('j1');
      expect(line.count).toBe(42);
    });
  });

  describe('warn', () => {
    it('emits to console.warn with level=WARN', () => {
      logger.warn('etl.fallback', { jobId: 'j2' });
      expect(warnSpy).toHaveBeenCalledOnce();
      const line = parseLastLine(warnSpy);
      expect(line.level).toBe('WARN');
      expect(line.event).toBe('etl.fallback');
      expect(line.jobId).toBe('j2');
    });
  });

  describe('error', () => {
    it('emits to console.error with level=ERROR', () => {
      logger.error('etl.failed', { jobId: 'j3' });
      expect(errorSpy).toHaveBeenCalledOnce();
      const line = parseLastLine(errorSpy);
      expect(line.level).toBe('ERROR');
      expect(line.event).toBe('etl.failed');
      expect(line.jobId).toBe('j3');
    });

    it('unpacks an Error attached as ctx.err into errorName / errorMessage / errorStack', () => {
      const err = new Error('boom');
      err.name = 'BoomError';
      logger.error('etl.failed', { jobId: 'j4', err });
      const line = parseLastLine(errorSpy);
      expect(line.errorName).toBe('BoomError');
      expect(line.errorMessage).toBe('boom');
      expect(typeof line.errorStack).toBe('string');
      // err should not appear as a raw field
      expect(line.err).toBeUndefined();
    });

    it('coerces a non-Error err to a string errorMessage', () => {
      logger.error('etl.failed', { err: 'plain string' });
      const line = parseLastLine(errorSpy);
      expect(line.errorMessage).toBe('plain string');
      expect(line.errorName).toBeUndefined();
    });

    it('omits err-related fields when no err is provided', () => {
      logger.error('etl.failed', { jobId: 'j5' });
      const line = parseLastLine(errorSpy);
      expect(line.errorName).toBeUndefined();
      expect(line.errorMessage).toBeUndefined();
      expect(line.errorStack).toBeUndefined();
    });
  });
});
