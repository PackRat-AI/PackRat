import { describe, expect, it } from 'vitest';
import { earlyAccessUntilFor } from '../apply-access-decision';
import { AUDIENCES } from '../detect-access-decisions';

describe('earlyAccessUntilFor', () => {
  it('everyone means no window', () => {
    // A GA feature has no early-access timestamp at all — null is what the
    // resolver reads as "free for everyone".
    expect(earlyAccessUntilFor({ audience: AUDIENCES.Everyone })).toBeNull();
  });

  it('everyone ignores a stray expiry', () => {
    // The PR check rejects this combination, but the write path should not
    // create a window if one somehow arrives.
    expect(earlyAccessUntilFor({ audience: AUDIENCES.Everyone, expiry: '2026-10-15' })).toBeNull();
  });

  it('early-access runs to the end of the named day', () => {
    // A window "through the 15th" must include the 15th. Using midnight would
    // expire it as the day begins, cutting the window a day short.
    expect(earlyAccessUntilFor({ audience: AUDIENCES.EarlyAccess, expiry: '2026-10-15' })).toBe(
      '2026-10-15T23:59:59.999Z',
    );
  });

  it('early-access with no expiry yields no window', () => {
    expect(earlyAccessUntilFor({ audience: AUDIENCES.EarlyAccess })).toBeNull();
  });

  it('a decision with no audience yields no window', () => {
    expect(earlyAccessUntilFor({})).toBeNull();
  });
});
