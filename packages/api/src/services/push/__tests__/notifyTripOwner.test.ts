import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectWhere = vi.fn();
  const deleteWhere = vi.fn();
  return {
    selectWhere,
    deleteWhere,
    sendApnsPush: vi.fn(),
    captureApiException: vi.fn(),
    createDbClient: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        select: (_cols: unknown) => ({ from: (_table: unknown) => ({ where: selectWhere }) }),
        delete: (_table: unknown) => ({ where: deleteWhere }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDbClient: mocks.createDbClient }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('../apnsClient', () => ({ sendApnsPush: mocks.sendApnsPush }));
vi.mock('@packrat/db/schema', () => ({
  userDeviceTokens: { id: 'id', userId: 'userId', deviceToken: 'deviceToken' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((col, val) => ({ col, val })) }));

import { notifyTripOwner, tripAlertNotification } from '../notifyTripOwner';

const env = {} as ValidatedEnv;

function alert(event: string): WeatherAlertItem {
  return { event, headline: `${event} in effect`, desc: 'desc' } as WeatherAlertItem;
}

const base = {
  env,
  userId: 'u1',
  tripId: 'trip-1',
  tripName: 'Enchantments',
  placeName: 'Leavenworth',
};

describe('tripAlertNotification', () => {
  it('names the trip, the alert and the place', () => {
    expect(
      tripAlertNotification({
        tripName: 'PCT',
        placeName: 'DeLand',
        alerts: [alert('Flood Warning')],
      }),
    ).toEqual({
      title: 'Weather alert for PCT',
      body: 'Flood Warning has been issued near DeLand. Check the forecast before you go.',
    });
  });

  it('lists distinct events once and falls back to "your destination" with no place name', () => {
    const { body } = tripAlertNotification({
      tripName: 'PCT',
      placeName: null,
      alerts: [alert('Flood Warning'), alert('Flood Warning'), alert('Wind Advisory')],
    });
    expect(body).toBe(
      'Flood Warning, Wind Advisory have been issued at your destination. Check the forecast before you go.',
    );
  });
});

describe('notifyTripOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectWhere.mockResolvedValue([
      { id: 't1', deviceToken: 'device-1' },
      { id: 't2', deviceToken: 'device-2' },
    ]);
    mocks.sendApnsPush.mockResolvedValue({ outcome: 'sent' });
    mocks.deleteWhere.mockResolvedValue(undefined);
  });

  it('does nothing without new alerts', async () => {
    await notifyTripOwner({ ...base, newAlerts: [] });
    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(0);
  });

  it("pushes to every one of the owner's devices with the trip id for deep-linking", async () => {
    await notifyTripOwner({ ...base, newAlerts: [alert('Flood Warning')] });

    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(2);
    expect(mocks.sendApnsPush.mock.calls[0]?.[0]).toMatchObject({
      deviceToken: 'device-1',
      payload: { tripId: 'trip-1', alert: { title: 'Weather alert for Enchantments' } },
    });
  });

  it('deletes an expired token and keeps going', async () => {
    mocks.sendApnsPush.mockResolvedValueOnce({ outcome: 'invalid-token' });

    await notifyTripOwner({ ...base, newAlerts: [alert('Flood Warning')] });

    expect(mocks.deleteWhere).toHaveBeenCalledWith({ col: 'id', val: 't1' });
    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(2);
  });

  it('captures an APNs error or a throw per device without aborting the batch', async () => {
    mocks.sendApnsPush
      .mockResolvedValueOnce({ outcome: 'error', status: 500, body: 'boom' })
      .mockRejectedValueOnce(new Error('network'));

    await notifyTripOwner({ ...base, newAlerts: [alert('Flood Warning')] });

    expect(mocks.captureApiException).toHaveBeenCalledTimes(2);
    expect(mocks.captureApiException.mock.calls[0]?.[0]).toMatchObject({
      operation: 'tripReminders.notifyTripOwner',
      extra: { tripId: 'trip-1', httpStatus: 500 },
    });
  });
});
