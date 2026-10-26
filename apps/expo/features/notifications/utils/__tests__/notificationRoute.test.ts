import { describe, expect, it } from 'vitest';
import { notificationRoute } from '../notificationRoute';

describe('notificationRoute', () => {
  it('opens the forecast for a weather alert', () => {
    expect(notificationRoute({ weatherLocationId: '2801268' })).toEqual({
      pathname: '/weather/[id]',
      params: { id: '2801268' },
    });
  });

  it('accepts a numeric id', () => {
    expect(notificationRoute({ weatherLocationId: 42 })).toEqual({
      pathname: '/weather/[id]',
      params: { id: '42' },
    });
  });

  it('opens the trip for a trip reminder', () => {
    expect(notificationRoute({ tripId: 'trip-9' })).toEqual({
      pathname: '/trip/[id]',
      params: { id: 'trip-9' },
    });
  });

  it('opens the post for a feed notification, ahead of any other id', () => {
    expect(notificationRoute({ postId: '7', tripId: 'trip-9' })).toEqual({
      pathname: '/feed/[id]',
      params: { id: '7' },
    });
  });

  it('ignores payloads it cannot route', () => {
    expect(notificationRoute(undefined)).toBeNull();
    expect(notificationRoute(null)).toBeNull();
    expect(notificationRoute({})).toBeNull();
    expect(notificationRoute({ weatherLocationId: '  ' })).toBeNull();
    expect(notificationRoute({ weatherLocationId: Number.NaN })).toBeNull();
    expect(notificationRoute({ weatherLocationId: { nested: true } })).toBeNull();
  });
});
