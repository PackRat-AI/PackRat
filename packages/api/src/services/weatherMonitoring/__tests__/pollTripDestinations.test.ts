import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tripsWhere = vi.fn();
  const stateFrom = vi.fn();
  const insertValues = vi.fn();
  const onConflictDoUpdate = vi.fn();
  return {
    tripsWhere,
    stateFrom,
    insertValues,
    onConflictDoUpdate,
    fetchCoordinateAlerts: vi.fn(),
    notifyTripOwner: vi.fn(),
    captureApiException: vi.fn(),
    createDbClient: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        select: (cols: Record<string, unknown>) =>
          'location' in cols
            ? { from: (_table: unknown) => ({ where: tripsWhere }) }
            : { from: stateFrom },
        insert: (_table: unknown) => ({
          values: (values: unknown) => {
            insertValues(values);
            return { onConflictDoUpdate };
          },
        }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDbClient: mocks.createDbClient }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('../fetchLocationAlerts', () => ({ fetchCoordinateAlerts: mocks.fetchCoordinateAlerts }));
vi.mock('../../push/notifyTripOwner', () => ({ notifyTripOwner: mocks.notifyTripOwner }));
vi.mock('@packrat/db/schema', () => ({
  trips: {
    id: 'id',
    userId: 'userId',
    name: 'name',
    location: 'location',
    deleted: 'deleted',
    startDate: 'startDate',
  },
  tripDestinationAlertState: {
    tripId: 'tripId',
    lastAlertIds: 'lastAlertIds',
    lastPolledAt: 'lastPolledAt',
  },
}));

import { pollTripDestinations } from '../pollTripDestinations';

const env = {} as ValidatedEnv;
const NOW = new Date('2026-10-06T12:00:00Z');
const MINUTE = 60 * 1000;

function alert(event: string): WeatherAlertItem {
  return {
    event,
    effective: '2026-10-06T00:00:00Z',
    headline: event,
    desc: '',
  } as WeatherAlertItem;
}

function trip(
  id: string,
  { latitude = 29.03, longitude = -81.3, name = 'DeLand' as string | null } = {},
) {
  return { id, userId: `user-${id}`, name: `Trip ${id}`, location: { latitude, longitude, name } };
}

describe('pollTripDestinations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tripsWhere.mockResolvedValue([trip('a')]);
    mocks.stateFrom.mockResolvedValue([]);
    mocks.fetchCoordinateAlerts.mockResolvedValue([]);
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);
    mocks.notifyTripOwner.mockResolvedValue(undefined);
  });

  it('pushes a new alert at the destination to the trip owner and records it', async () => {
    mocks.fetchCoordinateAlerts.mockResolvedValue([alert('Flood Warning')]);

    const result = await pollTripDestinations({ env, now: NOW });

    expect(result).toEqual({ checked: 1, skipped: 0, failed: 0, notified: 1 });
    expect(mocks.notifyTripOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-a',
        tripId: 'a',
        tripName: 'Trip a',
        placeName: 'DeLand',
      }),
    );
    expect(mocks.insertValues.mock.calls[0]?.[0]).toMatchObject({
      tripId: 'a',
      lastAlertIds: ['Flood Warning|2026-10-06T00:00:00Z'],
    });
  });

  it('stays silent for an alert it already pushed for this trip', async () => {
    mocks.fetchCoordinateAlerts.mockResolvedValue([alert('Flood Warning')]);
    mocks.stateFrom.mockResolvedValue([
      {
        tripId: 'a',
        lastAlertIds: ['Flood Warning|2026-10-06T00:00:00Z'],
        lastPolledAt: new Date(NOW.getTime() - 30 * MINUTE),
      },
    ]);

    const result = await pollTripDestinations({ env, now: NOW });

    expect(result.notified).toBe(0);
    expect(mocks.notifyTripOwner).toHaveBeenCalledTimes(0);
  });

  it('skips a trip polled less than 20 minutes ago', async () => {
    mocks.stateFrom.mockResolvedValue([
      { tripId: 'a', lastAlertIds: [], lastPolledAt: new Date(NOW.getTime() - 5 * MINUTE) },
    ]);

    const result = await pollTripDestinations({ env, now: NOW });

    expect(result).toEqual({ checked: 0, skipped: 1, failed: 0, notified: 0 });
    expect(mocks.fetchCoordinateAlerts).toHaveBeenCalledTimes(0);
  });

  it('fetches once for trips heading to the same place', async () => {
    mocks.tripsWhere.mockResolvedValue([
      trip('a'),
      trip('b', { latitude: 29.031, longitude: -81.302 }),
      trip('c', { latitude: 47.5, longitude: -120.8 }),
    ]);

    await pollTripDestinations({ env, now: NOW });

    expect(mocks.fetchCoordinateAlerts).toHaveBeenCalledTimes(2);
  });

  it('names no place when the destination has no name', async () => {
    mocks.tripsWhere.mockResolvedValue([trip('a', { name: null })]);
    mocks.fetchCoordinateAlerts.mockResolvedValue([alert('Flood Warning')]);

    await pollTripDestinations({ env, now: NOW });

    expect(mocks.notifyTripOwner).toHaveBeenCalledWith(
      expect.objectContaining({ placeName: null }),
    );
  });

  it('captures a failed fetch and carries on with the next trip', async () => {
    mocks.tripsWhere.mockResolvedValue([
      trip('a'),
      trip('b', { latitude: 47.5, longitude: -120.8 }),
    ]);
    mocks.fetchCoordinateAlerts
      .mockRejectedValueOnce(new Error('WeatherAPI down'))
      .mockResolvedValueOnce([]);

    const result = await pollTripDestinations({ env, now: NOW });

    expect(result).toEqual({ checked: 2, skipped: 0, failed: 1, notified: 0 });
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'tripReminders.pollTripDestination',
        extra: { tripId: 'a' },
      }),
    );
  });

  it('ignores a trip row without a location', async () => {
    mocks.tripsWhere.mockResolvedValue([{ id: 'x', userId: 'u', name: 'X', location: null }]);

    const result = await pollTripDestinations({ env, now: NOW });

    expect(result.checked).toBe(0);
  });
});
