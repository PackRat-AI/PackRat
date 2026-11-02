import { describe, expect, it } from 'vitest';
import { isCommentsChangedSignal, liveCommentsUrl, liveReconnectDelayMs } from '../liveComments';

describe('liveReconnectDelayMs', () => {
  it('backs off from 1 s to a 30 s cap', () => {
    expect([0, 1, 2, 3, 6, 9].map(liveReconnectDelayMs)).toEqual([
      1000, 1000, 2000, 4000, 30000, 30000,
    ]);
  });
});

describe('isCommentsChangedSignal', () => {
  it('accepts only the comments.changed frame', () => {
    expect(isCommentsChangedSignal('{"type":"comments.changed"}')).toBe(true);
    expect(isCommentsChangedSignal('pong')).toBe(false);
    expect(isCommentsChangedSignal('{"type":"other"}')).toBe(false);
    expect(isCommentsChangedSignal('null')).toBe(false);
    expect(isCommentsChangedSignal(42)).toBe(false);
  });
});

describe('liveCommentsUrl', () => {
  it('swaps http for ws and appends the live path', () => {
    expect(liveCommentsUrl('https://api.packrat.world/', 7)).toBe(
      'wss://api.packrat.world/api/feed/7/live',
    );
    expect(liveCommentsUrl('http://10.0.2.2:8787', 7)).toBe('ws://10.0.2.2:8787/api/feed/7/live');
  });
});
