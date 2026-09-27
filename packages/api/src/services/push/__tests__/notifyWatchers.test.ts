import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tags = vi.fn();
  const selectDistinctWhere = vi.fn();
  const selectWhere = vi.fn();
  const deleteWhere = vi.fn();
  return {
    tags,
    selectDistinctWhere,
    selectWhere,
    deleteWhere,
    sendApnsPush: vi.fn(),
    captureApiException: vi.fn(),
    createDbClient: vi.fn(() => {
      const db = {
        tag: (label: string) => {
          tags(label);
          return db;
        },
        selectDistinct: (_cols: unknown) => ({
          from: (_table: unknown) => ({ where: selectDistinctWhere }),
        }),
        select: (_cols: unknown) => ({
          from: (_table: unknown) => ({ where: selectWhere }),
        }),
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
  weatherWatchedLocations: { userId: 'userId', weatherLocationId: 'weatherLocationId' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  inArray: vi.fn((col, vals) => ({ col, vals })),
}));

import { notifyWatchers } from '../notifyWatchers';

const env = {} as ValidatedEnv;

function alert(overrides: Partial<WeatherAlertItem> = {}): WeatherAlertItem {
  return {
    event: 'Flood Warning',
    headline: 'Flood Warning until 6 PM',
    desc: 'Rising water expected along the river.',
    ...overrides,
  } as WeatherAlertItem;
}

/** One watcher with one device — the ordinary case most tests start from. */
function singleWatcherWithOneDevice() {
  mocks.selectDistinctWhere.mockResolvedValue([{ userId: 'user-1' }]);
  mocks.selectWhere.mockResolvedValue([{ id: 'token-row-1', deviceToken: 'device-1' }]);
}

describe('notifyWatchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendApnsPush.mockResolvedValue({ outcome: 'sent' });
    mocks.deleteWhere.mockResolvedValue(undefined);
  });

  it('does nothing when there are no new alerts', async () => {
    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [] });

    expect(mocks.createDbClient).toHaveBeenCalledTimes(0);
    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(0);
  });

  it('sends nothing when nobody is watching the location', async () => {
    mocks.selectDistinctWhere.mockResolvedValue([]);

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(0);
  });

  it('sends nothing when watchers have no registered devices', async () => {
    mocks.selectDistinctWhere.mockResolvedValue([{ userId: 'user-1' }]);
    mocks.selectWhere.mockResolvedValue([]);

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(0);
  });

  it('pushes to the watching device with the location id attached', async () => {
    singleWatcherWithOneDevice();

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.sendApnsPush).toHaveBeenCalledWith({
      env,
      deviceToken: 'device-1',
      payload: {
        alert: { title: 'Flood Warning', body: 'Flood Warning until 6 PM' },
        weatherLocationId: 42,
      },
    });
  });

  it('titles a single alert with the event and uses its headline as the body', async () => {
    singleWatcherWithOneDevice();

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    const { payload } = mocks.sendApnsPush.mock.calls[0]?.[0] as {
      payload: { alert: { title: string; body: string } };
    };
    expect(payload.alert).toEqual({
      title: 'Flood Warning',
      body: 'Flood Warning until 6 PM',
    });
  });

  it('falls back to the description when a single alert has no headline', async () => {
    singleWatcherWithOneDevice();

    await notifyWatchers({
      env,
      weatherLocationId: 42,
      newAlerts: [alert({ headline: '' })],
    });

    const { payload } = mocks.sendApnsPush.mock.calls[0]?.[0] as {
      payload: { alert: { body: string } };
    };
    expect(payload.alert.body).toBe('Rising water expected along the river.');
  });

  it('summarises by count and lists the events when several alerts land at once', async () => {
    singleWatcherWithOneDevice();

    await notifyWatchers({
      env,
      weatherLocationId: 42,
      newAlerts: [alert(), alert({ event: 'High Wind Warning' })],
    });

    const { payload } = mocks.sendApnsPush.mock.calls[0]?.[0] as {
      payload: { alert: { title: string; body: string } };
    };
    expect(payload.alert).toEqual({
      title: '2 new weather alerts',
      body: 'Flood Warning, High Wind Warning',
    });
  });

  it('pushes to every device of every watcher', async () => {
    mocks.selectDistinctWhere.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
    mocks.selectWhere.mockResolvedValue([
      { id: 'token-row-1', deviceToken: 'device-1' },
      { id: 'token-row-2', deviceToken: 'device-2' },
      { id: 'token-row-3', deviceToken: 'device-3' },
    ]);

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(3);
  });

  it('deletes the row for a token APNs reports as invalid, so the table self-cleans', async () => {
    singleWatcherWithOneDevice();
    mocks.sendApnsPush.mockResolvedValue({ outcome: 'invalid-token' });

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.deleteWhere).toHaveBeenCalledWith({ col: 'id', val: 'token-row-1' });
    expect(mocks.tags).toHaveBeenCalledWith('weatherMonitoring.deleteStaleDeviceToken');
  });

  it('reports an APNs error to Sentry with the status attached, without deleting the token', async () => {
    singleWatcherWithOneDevice();
    mocks.sendApnsPush.mockResolvedValue({ outcome: 'error', status: 500, body: 'boom' });

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'weatherMonitoring.notifyWatchers',
        extra: { weatherLocationId: 42, httpStatus: 500 },
      }),
    );
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(0);
  });

  it('captures a thrown send failure rather than aborting', async () => {
    singleWatcherWithOneDevice();
    const failure = new Error('network down');
    mocks.sendApnsPush.mockRejectedValue(failure);

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        error: failure,
        operation: 'weatherMonitoring.notifyWatchers',
      }),
    );
  });

  it('keeps delivering to the remaining devices after one throws', async () => {
    mocks.selectDistinctWhere.mockResolvedValue([{ userId: 'user-1' }]);
    mocks.selectWhere.mockResolvedValue([
      { id: 'token-row-1', deviceToken: 'device-1' },
      { id: 'token-row-2', deviceToken: 'device-2' },
    ]);
    mocks.sendApnsPush
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ outcome: 'sent' });

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(2);
    expect(mocks.sendApnsPush.mock.calls[1]?.[0]).toMatchObject({ deviceToken: 'device-2' });
  });

  it('tags both read queries so they are attributable in Neon logs', async () => {
    singleWatcherWithOneDevice();

    await notifyWatchers({ env, weatherLocationId: 42, newAlerts: [alert()] });

    expect(mocks.tags).toHaveBeenCalledWith('weatherMonitoring.listWatchersForLocation');
    expect(mocks.tags).toHaveBeenCalledWith('weatherMonitoring.listDeviceTokensForWatchers');
  });
});
