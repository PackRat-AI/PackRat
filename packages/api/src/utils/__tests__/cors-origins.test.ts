import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '../cors-origins';

describe('isAllowedOrigin', () => {
  describe('production origins', () => {
    it.each([
      'https://packrat.world',
      'https://www.packrat.world',
      'https://app.packrat.world',
      'https://admin.packratai.com',
      'https://packrat-api.workers.dev',
      'http://localhost:3001',
      'http://localhost:8787',
      'exp://192.168.1.10:8081',
    ])('allows %s', (origin) => {
      expect(isAllowedOrigin(origin)).toBe(true);
    });
  });

  describe('portless local-dev proxy origins', () => {
    it.each([
      // Worktree-prefixed hosts, clean :443 form (no port in URL).
      'https://portless-packrat.web.localhost',
      'https://feat-auth.api.localhost',
      // Worktree-prefixed hosts, :1355 fallback form (port in URL).
      'https://portless-packrat.web.localhost:1355',
      'https://feat-auth.api.localhost:1355',
      // Single-label localhost host.
      'https://web.localhost',
    ])('allows %s', (origin) => {
      expect(isAllowedOrigin(origin)).toBe(true);
    });
  });

  describe('rejected origins', () => {
    it.each([
      null,
      '',
      'https://evil.com',
      'https://packrat.world.evil.com',
      // .localhost must be the final label — these are public-resolvable look-alikes.
      'https://evil.localhost.com',
      'https://x.localhostevil.com',
      // http (not https) .localhost is not in the allowlist (only the proxy's https form).
      'http://portless-packrat.web.localhost:1355',
      'localhost',
    ])('rejects %s', (origin) => {
      expect(isAllowedOrigin(origin)).toBe(false);
    });
  });
});
