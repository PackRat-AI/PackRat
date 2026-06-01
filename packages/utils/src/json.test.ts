import { describe, expect, it } from 'vitest';
import { configureStringify, safeParse, safeStringify, stableStringify } from './json';

describe('safeStringify', () => {
  it('preserves key insertion order (drop-in for JSON.stringify)', () => {
    expect(safeStringify({ b: 2, a: 1 })).toBe('{"b":2,"a":1}');
  });

  it('does not throw on circular references', () => {
    const circular: Record<string, unknown> = { name: 'root' };
    circular.self = circular;
    const out = safeStringify(circular);
    expect(typeof out).toBe('string');
    expect(out).toContain('"name":"root"');
  });

  it('serializes BigInt instead of throwing', () => {
    expect(safeStringify({ n: 10n })).toBe('{"n":10}');
  });

  it('honors the space argument', () => {
    expect(safeStringify({ a: 1 }, null, 2)).toBe('{\n  "a": 1\n}');
  });

  it('returns undefined for undefined input, matching JSON.stringify', () => {
    expect(safeStringify(undefined)).toBeUndefined();
  });
});

describe('stableStringify', () => {
  it('sorts keys deterministically regardless of input order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });
});

describe('configureStringify', () => {
  it('builds a custom stringifier (maximumDepth)', () => {
    const shallow = configureStringify({ maximumDepth: 1, deterministic: false });
    const out = shallow({ a: { b: { c: 1 } } });
    // Beyond the depth limit the value is replaced rather than throwing.
    expect(typeof out).toBe('string');
    expect(out).not.toContain('"c"');
  });
});

describe('safeParse', () => {
  it('parses valid JSON into the expected shape', () => {
    expect(safeParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('coerces JSON primitives', () => {
    expect(safeParse('123')).toBe(123);
    expect(safeParse('true')).toBe(true);
  });

  it('never throws on non-JSON input (returns the input unchanged)', () => {
    expect(safeParse('not json at all')).toBe('not json at all');
  });

  it('guards against prototype pollution', () => {
    const parsed = safeParse<Record<string, unknown>>('{"__proto__":{"polluted":true}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });

  it('throws on invalid input when { strict: true } (preserves JSON.parse behavior)', () => {
    expect(() => safeParse('not json at all', { strict: true })).toThrow();
    expect(safeParse<{ a: number }>('{"a":1}', { strict: true })).toEqual({ a: 1 });
  });
});
