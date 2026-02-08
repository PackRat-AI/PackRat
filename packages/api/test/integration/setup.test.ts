import { describe, expect, it } from 'vitest';

describe('integration test setup', () => {
  it('should work with Node.js environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(typeof process.exit).toBe('function');
  });

  it('should have database connection config', () => {
    expect(process.env.NEON_DATABASE_URL).toContain('localhost:5433');
  });
});
