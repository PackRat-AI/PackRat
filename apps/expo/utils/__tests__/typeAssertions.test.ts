import { describe, expect, it } from 'vitest';
import { assertDefined, assertIsString, assertNonNull } from '../typeAssertions';

describe('assertDefined', () => {
  it('does not throw for a defined value', () => {
    expect(() => assertDefined('hello')).not.toThrow();
    expect(() => assertDefined(0)).not.toThrow();
    expect(() => assertDefined(null)).not.toThrow();
    expect(() => assertDefined(false)).not.toThrow();
  });

  it('throws for undefined', () => {
    expect(() => assertDefined(undefined)).toThrow('Expects value to be defined');
  });
});

describe('assertNonNull', () => {
  it('does not throw for a non-null value', () => {
    expect(() => assertNonNull('hello')).not.toThrow();
    expect(() => assertNonNull(0)).not.toThrow();
    expect(() => assertNonNull(false)).not.toThrow();
    expect(() => assertNonNull(undefined)).not.toThrow();
  });

  it('throws for null', () => {
    expect(() => assertNonNull(null)).toThrow('Expects value to be non-null');
  });
});

describe('assertIsString', () => {
  it('does not throw for string values', () => {
    expect(() => assertIsString('hello')).not.toThrow();
    expect(() => assertIsString('')).not.toThrow();
  });

  it('throws for non-string values', () => {
    expect(() => assertIsString(123)).toThrow('Expected a string');
    expect(() => assertIsString(null)).toThrow('Expected a string');
    expect(() => assertIsString(undefined)).toThrow('Expected a string');
    expect(() => assertIsString({})).toThrow('Expected a string');
    expect(() => assertIsString([])).toThrow('Expected a string');
  });
});
