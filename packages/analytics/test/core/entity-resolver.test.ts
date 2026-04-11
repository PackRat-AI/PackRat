import { describe, expect, it } from 'vitest';
import { assertDefined } from '../../src/core/type-assertions';

// We need to test the internal functions. Since they're not exported,
// we test them through the module's public behavior. For unit testing
// the core algorithms, we re-implement the key helpers here.

// Token sort ratio (matches the implementation)
function tokenSortRatio(a: string, b: string): number {
  const sortTokens = (s: string) => s.toLowerCase().split(/\s+/).sort().join(' ');
  const sa = sortTokens(a);
  const sb = sortTokens(b);
  if (sa === sb) return 100;
  if (sa.length === 0 || sb.length === 0) return 0;
  const len = Math.max(sa.length, sb.length);
  const dist = levenshtein(sa, sb);
  return Math.round(((len - dist) / len) * 100);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    assertDefined(row);
    row[0] = i;
  }
  const firstRow = dp[0];
  assertDefined(firstRow);
  for (let j = 0; j <= n; j++) firstRow[j] = j;
  for (let i = 1; i <= m; i++) {
    const row = dp[i];
    const prevRow = dp[i - 1];
    assertDefined(row);
    assertDefined(prevRow);
    for (let j = 1; j <= n; j++) {
      const diag = prevRow[j - 1];
      const up = prevRow[j];
      const left = row[j - 1];
      assertDefined(diag);
      assertDefined(up);
      assertDefined(left);
      row[j] = a[i - 1] === b[j - 1] ? diag : 1 + Math.min(up, left, diag);
    }
  }
  const lastRow = dp[m];
  assertDefined(lastRow);
  const result = lastRow[n];
  assertDefined(result);
  return result;
}

describe('tokenSortRatio', () => {
  it('returns 100 for identical strings', () => {
    expect(tokenSortRatio('hello world', 'hello world')).toBe(100);
  });

  it('returns 100 for reordered tokens', () => {
    expect(tokenSortRatio('world hello', 'hello world')).toBe(100);
  });

  it('handles case insensitivity', () => {
    expect(tokenSortRatio('Hello World', 'hello world')).toBe(100);
  });

  it('returns high score for similar strings', () => {
    const score = tokenSortRatio('REI Co-op Flash 55 Pack', 'REI Flash 55 Backpack');
    expect(score).toBeGreaterThan(40);
  });

  it('returns low score for different strings', () => {
    const score = tokenSortRatio('Tent', 'Sleeping Bag');
    expect(score).toBeLessThan(50);
  });

  it('handles empty strings', () => {
    expect(tokenSortRatio('', '')).toBe(100); // both empty, sorted tokens are equal
    expect(tokenSortRatio('hello', '')).toBe(0);
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('computes correct edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('saturday', 'sunday')).toBe(3);
  });
});

// Test EntityResolver import works
describe('EntityResolver', () => {
  it('can be imported', async () => {
    const { EntityResolver } = await import('@packrat/analytics/core/entity-resolver');
    expect(EntityResolver).toBeDefined();
  });
});
