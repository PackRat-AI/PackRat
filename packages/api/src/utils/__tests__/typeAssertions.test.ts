import { describe, expect, it } from 'vitest';
import { assertAllDefined, assertDefined } from '../typeAssertions';

describe('assertDefined', () => {
  it('does not throw for a defined value', () => {
    expect(() => assertDefined('hello')).not.toThrow();
    expect(() => assertDefined(0)).not.toThrow();
    expect(() => assertDefined(null)).not.toThrow();
    expect(() => assertDefined(false)).not.toThrow();
  });

  it('throws for undefined', () => {
    expect(() => assertDefined(undefined)).toThrow('Value must be defined');
  });
});

describe('assertAllDefined', () => {
  it('does not throw when all values are defined', () => {
    expect(() => assertAllDefined('a', 1, false, null, 0)).not.toThrow();
  });

  it('throws when any value is undefined', () => {
    expect(() => assertAllDefined('a', undefined, 'b')).toThrow('Value at index 1 must be defined');
  });

  it('throws with the correct index when the first value is undefined', () => {
    expect(() => assertAllDefined(undefined, 'b')).toThrow('Value at index 0 must be defined');
  });

  it('does not throw for an empty argument list', () => {
    expect(() => assertAllDefined()).not.toThrow();
  });
});
