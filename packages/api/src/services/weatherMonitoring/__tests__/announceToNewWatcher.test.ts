import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectWhere = vi.fn();
  return {
    selectWhere,
    fetchLocationAlerts: vi.fn(),
    notifyWatchers: vi.fn(),
    createDbClient: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        select: (_cols: unknown) => ({
          from: (_table: unknown) => ({ where: selectWhere }),
        }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDbClient: mocks.createDbClient }));
vi.mock('@packrat/db/schema', () => ({
  weatherLocationAlertState: {
    weatherLocationId: 'weatherLocationId',
    lastAlertIds: 'lastAlertIds',
  },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((col, val) => ({ col, val })) }));
vi.mock('../fetchLocationAlerts', () => ({ fetchLocationAlerts: mocks.fetchLocationAlerts }));
vi.mock('../../push/notifyWatchers', () => ({ notifyWatchers: mocks.notifyWatchers }));

import { announceActiveAlertsToNewWatcher } from '../announceToNewWatcher';

const env = {} as ValidatedEnv;

function alert(event: string, effective = '2026-10-23T09:00:00Z'): WeatherAlertItem {
  return { event, effective, headline: `${event} in effect`, desc: '' } as WeatherAlertItem;
}

const flood = alert('Flood Warning');
const wind = alert('Wind Advisory');

describe('announceActiveAlertsToNewWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tells only the new watcher about alerts already announced at the place', async () => {
    mocks.selectWhere.mockResolvedValue([{ lastAlertIds: ['Flood Warning|2026-10-23T09:00:00Z'] }]);
    mocks.fetchLocationAlerts.mockResolvedValue([flood]);

    await announceActiveAlertsToNewWatcher({ env, userId: 'user-2', weatherLocationId: 42 });

    expect(mocks.notifyWatchers).toHaveBeenCalledWith({
      env,
      weatherLocationId: 42,
      newAlerts: [flood],
      onlyUserIds: ['user-2'],
    });
  });

  it('leaves alerts the timer has not announced yet to the timer, so nobody hears one twice', async () => {
    mocks.selectWhere.mockResolvedValue([{ lastAlertIds: ['Flood Warning|2026-10-23T09:00:00Z'] }]);
    mocks.fetchLocationAlerts.mockResolvedValue([flood, wind]);

    await announceActiveAlertsToNewWatcher({ env, userId: 'user-2', weatherLocationId: 42 });

    expect(mocks.notifyWatchers).toHaveBeenCalledWith(
      expect.objectContaining({ newAlerts: [flood] }),
    );
  });

  it('does nothing for a place the timer has never announced anything at', async () => {
    mocks.selectWhere.mockResolvedValue([]);

    await announceActiveAlertsToNewWatcher({ env, userId: 'user-2', weatherLocationId: 42 });

    expect(mocks.fetchLocationAlerts).toHaveBeenCalledTimes(0);
    expect(mocks.notifyWatchers).toHaveBeenCalledTimes(0);
  });

  it('does nothing once the announced alerts have expired', async () => {
    mocks.selectWhere.mockResolvedValue([{ lastAlertIds: ['Flood Warning|2026-10-23T09:00:00Z'] }]);
    mocks.fetchLocationAlerts.mockResolvedValue([]);

    await announceActiveAlertsToNewWatcher({ env, userId: 'user-2', weatherLocationId: 42 });

    expect(mocks.notifyWatchers).toHaveBeenCalledTimes(0);
  });
});
