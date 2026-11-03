import { describe, expect, it } from 'vitest';
import { FeedApiError, feedErrorMessage, serverMessage } from '../errorCopy';

describe('serverMessage', () => {
  it('reads a string or an { error } body', () => {
    expect(serverMessage('nope')).toBe('nope');
    expect(serverMessage({ error: 'Suspended' })).toBe('Suspended');
    expect(serverMessage({ error: 5 })).toBeNull();
    expect(serverMessage(null)).toBeNull();
  });
});

describe('feedErrorMessage', () => {
  it('shows a short 4xx server message as-is', () => {
    const error = new FeedApiError({
      message: 'x',
      status: 403,
      serverMessage: 'Posting is suspended for this account',
    });
    expect(feedErrorMessage({ error: error, fallback: 'fallback' })).toBe(
      'Posting is suspended for this account',
    );
    expect(error.name).toBe('FeedApiError');
  });

  it('falls back for 5xx, long, JSON-looking, missing or foreign errors', () => {
    expect(
      feedErrorMessage({
        error: new FeedApiError({ message: 'x', status: 500, serverMessage: 'boom' }),
        fallback: 'fb',
      }),
    ).toBe('fb');
    expect(
      feedErrorMessage({
        error: new FeedApiError({ message: 'x', status: 400, serverMessage: 'a'.repeat(161) }),
        fallback: 'fb',
      }),
    ).toBe('fb');
    expect(
      feedErrorMessage({
        error: new FeedApiError({ message: 'x', status: 400, serverMessage: '{"a":1}' }),
        fallback: 'fb',
      }),
    ).toBe('fb');
    expect(
      feedErrorMessage({
        error: new FeedApiError({ message: 'x', status: 400, serverMessage: null }),
        fallback: 'fb',
      }),
    ).toBe('fb');
    expect(feedErrorMessage({ error: new Error('x'), fallback: 'fb' })).toBe('fb');
  });
});
