import { describe, expect, it } from 'vitest';
import { copyRequestHeaders } from '../request-headers';

describe('copyRequestHeaders', () => {
  it('copies records and empty input', () => {
    expect(copyRequestHeaders({ Authorization: 'synthetic' }).get('authorization')).toBe(
      'synthetic',
    );
    expect([...copyRequestHeaders()]).toEqual([]);
  });

  it('copies Headers without mutating the original', () => {
    const original = new Headers({ Authorization: 'synthetic' });
    const copy = copyRequestHeaders(original);
    copy.delete('authorization');
    expect(original.get('authorization')).toBe('synthetic');
    expect(copy.has('authorization')).toBe(false);
  });

  it('preserves iterable pairs, duplicate values, and validation', () => {
    const pairs = new Map([
      ['x-example', 'one'],
      ['x-other', 'two'],
    ]);
    expect(copyRequestHeaders(pairs).get('x-other')).toBe('two');
    expect(
      copyRequestHeaders([
        ['x-example', 'one'],
        ['x-example', 'two'],
      ]).get('x-example'),
    ).toBe('one, two');
    expect(() => Reflect.apply(copyRequestHeaders, undefined, [[['invalid pair']]])).toThrow();
  });
});

// Reflect deliberately supplies invalid runtime input to check Fetch validation.
it('rejects malformed iterable inputs rather than manufacturing headers', () => {
  for (const malformed of [['ab'], [{ 0: 'x', 1: 'v', length: 2 }], { [Symbol.iterator]: null }]) {
    expect(() => Reflect.apply(copyRequestHeaders, undefined, [malformed])).toThrow(TypeError);
  }
});

it('preserves callable iterable pairs accepted by Fetch', () => {
  const pair = Object.assign(() => undefined, {
    *[Symbol.iterator]() {
      yield 'x-example';
      yield 'value';
    },
  });
  expect(copyRequestHeaders([pair]).get('x-example')).toBe('value');
});
