import { describe, expect, it } from 'vitest';
import * as array from './array';
import * as asyncUtils from './async';
import * as fn from './fn';
import * as math from './math';
import * as object from './object';
import * as predicates from './predicates';
import * as string from './string';

// Re-export files carry no logic of their own — these tests confirm the
// curated surface is wired and the right implementation answers to each name.
// (Upstream lib behavior is the libs' own concern; we assert representative
// behavior so a mis-wired or renamed export is caught.)

describe('array surface', () => {
  it('unique dedupes', () => expect(array.unique([1, 1, 2, 3, 3])).toEqual([1, 2, 3]));
  it('group buckets by key fn', () => {
    expect(array.group([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'))).toEqual({
      odd: [1, 3],
      even: [2, 4],
    });
  });
  it('chunk splits into fixed sizes', () =>
    expect(array.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
});

describe('object surface', () => {
  it('pick selects keys', () => expect(object.pick({ a: 1, b: 2 }, ['a'])).toEqual({ a: 1 }));
  it('omit drops keys', () => expect(object.omit({ a: 1, b: 2 }, ['a'])).toEqual({ b: 2 }));
  it('mapValues transforms values', () =>
    expect(object.mapValues({ a: 1, b: 2 }, (v) => v * 10)).toEqual({ a: 10, b: 20 }));
});

describe('string surface', () => {
  it('capitalize upper-cases the first letter', () =>
    expect(string.capitalize('trail')).toBe('Trail'));
  it('title produces Title Case', () =>
    expect(string.title('pack rat utils')).toBe('Pack Rat Utils'));
});

describe('math surface', () => {
  it('sum adds a list', () => expect(math.sum([1, 2, 3])).toBe(6));
  it('sumBy adds a selected field', () =>
    expect(math.sumBy([{ w: 2 }, { w: 3 }], (o) => o.w)).toBe(5));
  it('clamp bounds a value', () => expect(math.clamp(50, 1, 20)).toBe(20));
  it('round respects precision', () => expect(math.round(1.2345, 2)).toBe(1.23));
  it('maxBy selects by field', () =>
    expect(math.maxBy([{ h: 1 }, { h: 9 }, { h: 4 }], (o) => o.h)).toEqual({ h: 9 }));
});

describe('fn surface', () => {
  it('once invokes the underlying fn a single time', () => {
    let calls = 0;
    const init = fn.once(() => {
      calls += 1;
      return calls;
    });
    expect(init()).toBe(1);
    expect(init()).toBe(1);
    expect(calls).toBe(1);
  });
  it('pipe threads a value through transforms (dataLast composition)', () => {
    expect(
      fn.pipe(
        2,
        (n: number) => n + 1,
        (n: number) => n * 3,
      ),
    ).toBe(9);
  });
});

describe('predicates surface (technical source for @packrat/guards)', () => {
  it('isString narrows strings', () => {
    expect(predicates.isString('x')).toBe(true);
    expect(predicates.isString(1)).toBe(false);
  });
  it('isArray narrows arrays', () => {
    expect(predicates.isArray([1])).toBe(true);
    expect(predicates.isArray('no')).toBe(false);
  });
  it('isEmpty detects empties', () => {
    expect(predicates.isEmpty([])).toBe(true);
    expect(predicates.isEmpty([1])).toBe(false);
  });
});

describe('async surface', () => {
  it('sleep resolves after the delay', async () => {
    const start = performance.now();
    await asyncUtils.sleep(5);
    expect(performance.now() - start).toBeGreaterThanOrEqual(4);
  });
  it('tryit returns an error-tuple instead of throwing', async () => {
    const [ok, okVal] = await asyncUtils.tryit(async () => 42)();
    expect(ok).toBeUndefined();
    expect(okVal).toBe(42);
    const [err] = await asyncUtils.tryit(async () => {
      throw new Error('boom');
    })();
    expect(err).toBeInstanceOf(Error);
  });
});
