import { describe, expect, it } from 'vitest';
import { getTripNavigationParams } from '../getTripNavigationParams';

/**
 * Tests for getTripNavigationParams.
 *
 * These assertions guard against accidental reversion to the old (broken)
 * plural route `/trips/:id`.  The Expo Router route is `/trip/[id]`
 * (singular), so every navigation from TripNotificationsList must use that
 * path.
 */
describe('getTripNavigationParams', () => {
  it('returns the correct Expo Router pathname for the trip detail screen', () => {
    const params = getTripNavigationParams('abc-123');
    expect(params.pathname).toBe('/trip/[id]');
  });

  it('maps the supplied tripId to the id param', () => {
    const tripId = 'trip-42';
    const params = getTripNavigationParams(tripId);
    expect(params.params.id).toBe(tripId);
  });

  it('does NOT use the old plural /trips path', () => {
    const params = getTripNavigationParams('some-id');
    expect(params.pathname).not.toContain('/trips/');
    expect(params.pathname).not.toBe('/trips/[id]');
  });

  it('produces the same shape expected by router.push', () => {
    const tripId = 'notification-trip-1';
    const result = getTripNavigationParams(tripId);
    // Simulate the assertion TripNotificationsList makes via router.push
    expect(result).toEqual({
      pathname: '/trip/[id]',
      params: { id: tripId },
    });
  });

  it('handles arbitrary tripId values', () => {
    const ids = ['', 'uuid-xxxx', '1234', 'a-b-c-d'];
    for (const id of ids) {
      const result = getTripNavigationParams(id);
      expect(result).toEqual({ pathname: '/trip/[id]', params: { id } });
    }
  });
});
