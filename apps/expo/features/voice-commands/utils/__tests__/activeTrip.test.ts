import type { Trip } from 'expo-app/features/trips/types';
import { describe, expect, it } from 'vitest';
import { activeTrip, tripInProgress } from '../activeTrip';

const now = new Date(2026, 10, 17, 9, 0);

function trip(id: string, overrides: Partial<Trip> = {}): Trip {
  return { id, name: id, status: 'planned', deleted: false, ...overrides } as Trip;
}

describe('activeTrip', () => {
  it('prefers the trip being tracked or guided', () => {
    const trips = [
      trip('a', { status: 'in_progress', startedAt: '2026-11-17T08:00:00Z' }),
      trip('b', { status: 'in_progress', startedAt: '2026-11-16T08:00:00Z' }),
    ];
    expect(activeTrip({ trips, busyTripIds: ['b'], now })?.id).toBe('b');
  });

  it('otherwise takes the trip in progress that started last', () => {
    const trips = [
      trip('a', { status: 'in_progress', startedAt: '2026-11-15T08:00:00Z' }),
      trip('b', { status: 'in_progress', startedAt: '2026-11-17T08:00:00Z' }),
      trip('c', { status: 'in_progress', startedAt: '2026-11-18T08:00:00Z', deleted: true }),
    ];
    expect(activeTrip({ trips, busyTripIds: [], now })?.id).toBe('b');
  });

  it('falls back to a planned trip starting today, which is not yet in progress', () => {
    const trips = [
      trip('later', { startDate: '2026-11-20' }),
      trip('today', { startDate: '2026-11-17' }),
    ];
    expect(activeTrip({ trips, busyTripIds: [], now })?.id).toBe('today');
    expect(tripInProgress({ trips, busyTripIds: [], now })).toBeNull();
  });

  it('skips finished trips', () => {
    const trips = [trip('done', { status: 'complete', startDate: '2026-11-17' })];
    expect(activeTrip({ trips, busyTripIds: ['done'], now })).toBeNull();
  });
});
