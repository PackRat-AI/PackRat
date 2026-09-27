import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tags = vi.fn();
  const selectDistinctFrom = vi.fn();
  const selectFrom = vi.fn();
  const insertValues = vi.fn();
  const onConflictDoUpdate = vi.fn();
  return {
    tags,
    selectDistinctFrom,
    selectFrom,
    insertValues,
    onConflictDoUpdate,
    fetchLocationAlerts: vi.fn(),
    notifyWatchers: vi.fn(),
    captureApiException: vi.fn(),
    createDbClient: vi.fn(() => {
      const db = {
        tag: (label: string) => {
          tags(label);
          return db;
        },
        selectDistinct: (_cols: unknown) => ({ from: selectDistinctFrom }),
        select: (_cols: unknown) => ({ from: selectFrom }),
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
vi.mock('../fetchLocationAlerts', () => ({ fetchLocationAlerts: mocks.fetchLocationAlerts }));
vi.mock('../../push/notifyWatchers', () => ({ notifyWatchers: mocks.notifyWatchers }));
vi.mock('@packrat/db/schema', () => ({
  weatherWatchedLocations: { weatherLocationId: 'weatherLocationId' },
  weatherLocationAlertState: {
    weatherLocationId: 'weatherLocationId',
    lastAlertIds: 'lastAlertIds',
    pollTier: 'pollTier',
    lastPolledAt: 'lastPolledAt',
    activeSince: 'activeSince',
  },
}));

import { pollWatchedLocations } from '../pollWatchedLocations';

const env = {} as ValidatedEnv;

const NOW = new Date('2026-01-01T12:00:00Z');
const MINUTE = 60 * 1000;

function alert(event: string): WeatherAlertItem {
  return {
    headline: `${event} in effect`,
    msgtype: 'Alert',
    severity: 'Severe',
    urgency: 'Expected',
    areas: 'Boulder County',
    category: 'Met',
    certainty: 'Likely',
    event,
    effective: '2026-01-01T00:00:00Z',
    expires: '2026-01-01T18:00:00Z',
    desc: `${event} description`,
  } as WeatherAlertItem;
}

/**
 * Alert ids are `event|effective` (see diffAlerts.alertId), so stored state has
 * to be written in that shape or a still-active alert reads as brand new.
 */
const FLOOD_WARNING_ID = 'Flood Warning|2026-01-01T00:00:00Z';

/** Whatever `upsertAlertState` was handed this run. */
function upsertedState() {
  return mocks.insertValues.mock.calls[0]?.[0] as {
    weatherLocationId: number;
    pollTier: string;
    activeSince: Date | null | undefined;
    lastAlertIds: string[];
    lastPolledAt: Date;
  };
}

function watching(...ids: number[]) {
  mocks.selectDistinctFrom.mockResolvedValue(
    ids.map((weatherLocationId) => ({ weatherLocationId })),
  );
}

function withState(...states: Record<string, unknown>[]) {
  mocks.selectFrom.mockResolvedValue(states);
}

describe('pollWatchedLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    watching(42);
    withState();
    mocks.fetchLocationAlerts.mockResolvedValue([]);
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);
    mocks.notifyWatchers.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports nothing checked when no location is watched', async () => {
    watching();

    const result = await pollWatchedLocations({ env });

    expect(result).toEqual({ checked: 0, skipped: 0, failed: 0, notified: 0 });
    expect(mocks.fetchLocationAlerts).toHaveBeenCalledTimes(0);
  });

  it('polls a location that has never been polled before', async () => {
    const result = await pollWatchedLocations({ env });

    expect(mocks.fetchLocationAlerts).toHaveBeenCalledWith(42);
    expect(result.checked).toBe(1);
  });

  it('polls each distinct location once, however many users watch it', async () => {
    watching(42, 43);

    const result = await pollWatchedLocations({ env });

    expect(mocks.fetchLocationAlerts).toHaveBeenCalledTimes(2);
    expect(result.checked).toBe(2);
  });

  it('skips a baseline location polled less than 20 minutes ago', async () => {
    withState({
      weatherLocationId: 42,
      lastAlertIds: [],
      pollTier: 'baseline',
      lastPolledAt: new Date(NOW.getTime() - 19 * MINUTE),
      activeSince: null,
    });

    const result = await pollWatchedLocations({ env });

    expect(result).toMatchObject({ checked: 0, skipped: 1 });
    expect(mocks.fetchLocationAlerts).toHaveBeenCalledTimes(0);
  });

  it('polls a baseline location once its 20-minute interval has elapsed', async () => {
    withState({
      weatherLocationId: 42,
      lastAlertIds: [],
      pollTier: 'baseline',
      lastPolledAt: new Date(NOW.getTime() - 21 * MINUTE),
      activeSince: null,
    });

    const result = await pollWatchedLocations({ env });

    expect(result).toMatchObject({ checked: 1, skipped: 0 });
  });

  it('polls an alerting location on the tighter 5-minute interval', async () => {
    withState({
      weatherLocationId: 42,
      lastAlertIds: [FLOOD_WARNING_ID],
      pollTier: 'elevated',
      lastPolledAt: new Date(NOW.getTime() - 6 * MINUTE),
      activeSince: new Date(NOW.getTime() - 60 * MINUTE),
    });

    const result = await pollWatchedLocations({ env });

    expect(result).toMatchObject({ checked: 1, skipped: 0 });
  });

  it('skips an alerting location inside its 5-minute interval', async () => {
    withState({
      weatherLocationId: 42,
      lastAlertIds: [FLOOD_WARNING_ID],
      pollTier: 'elevated',
      lastPolledAt: new Date(NOW.getTime() - 4 * MINUTE),
      activeSince: new Date(NOW.getTime() - 60 * MINUTE),
    });

    const result = await pollWatchedLocations({ env });

    expect(result).toMatchObject({ checked: 0, skipped: 1 });
  });

  it('notifies watchers when a new alert appears', async () => {
    mocks.fetchLocationAlerts.mockResolvedValue([alert('Flood Warning')]);

    const result = await pollWatchedLocations({ env });

    expect(mocks.notifyWatchers).toHaveBeenCalledWith({
      env,
      weatherLocationId: 42,
      newAlerts: [expect.objectContaining({ event: 'Flood Warning' })],
    });
    expect(result.notified).toBe(1);
  });

  it('raises the location to the elevated tier once it has an active alert', async () => {
    mocks.fetchLocationAlerts.mockResolvedValue([alert('Flood Warning')]);

    await pollWatchedLocations({ env });

    expect(upsertedState().pollTier).toBe('elevated');
  });

  it('stamps activeSince when a clear location first goes active', async () => {
    mocks.fetchLocationAlerts.mockResolvedValue([alert('Flood Warning')]);

    await pollWatchedLocations({ env });

    expect(upsertedState().activeSince).toEqual(NOW);
  });

  it('keeps the original activeSince while a location stays active', async () => {
    const originalActiveSince = new Date(NOW.getTime() - 120 * MINUTE);
    withState({
      weatherLocationId: 42,
      lastAlertIds: [FLOOD_WARNING_ID],
      pollTier: 'elevated',
      lastPolledAt: new Date(NOW.getTime() - 6 * MINUTE),
      activeSince: originalActiveSince,
    });
    mocks.fetchLocationAlerts.mockResolvedValue([alert('Flood Warning')]);

    await pollWatchedLocations({ env });

    expect(upsertedState().activeSince).toEqual(originalActiveSince);
  });

  it('does not notify again for an alert already seen', async () => {
    withState({
      weatherLocationId: 42,
      lastAlertIds: [FLOOD_WARNING_ID],
      pollTier: 'elevated',
      lastPolledAt: new Date(NOW.getTime() - 6 * MINUTE),
      activeSince: new Date(NOW.getTime() - 60 * MINUTE),
    });
    mocks.fetchLocationAlerts.mockResolvedValue([alert('Flood Warning')]);

    const result = await pollWatchedLocations({ env });

    expect(mocks.notifyWatchers).toHaveBeenCalledTimes(0);
    expect(result.notified).toBe(0);
  });

  it('never pushes when an alert resolves, but does clear the state', async () => {
    withState({
      weatherLocationId: 42,
      lastAlertIds: [FLOOD_WARNING_ID],
      pollTier: 'elevated',
      lastPolledAt: new Date(NOW.getTime() - 6 * MINUTE),
      activeSince: new Date(NOW.getTime() - 60 * MINUTE),
    });
    mocks.fetchLocationAlerts.mockResolvedValue([]);

    const result = await pollWatchedLocations({ env });

    expect(mocks.notifyWatchers).toHaveBeenCalledTimes(0);
    expect(result.notified).toBe(0);
    expect(upsertedState()).toMatchObject({
      pollTier: 'baseline',
      activeSince: null,
      lastAlertIds: [],
    });
  });

  it('records the poll time so the next run can honour the interval', async () => {
    await pollWatchedLocations({ env });

    expect(upsertedState().lastPolledAt).toEqual(NOW);
  });

  it('counts a fetch failure and reports it without aborting the run', async () => {
    const failure = new Error('WeatherAPI HTTP 500 for location 42');
    mocks.fetchLocationAlerts.mockRejectedValue(failure);

    const result = await pollWatchedLocations({ env });

    expect(result).toMatchObject({ failed: 1, notified: 0 });
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        error: failure,
        operation: 'weatherMonitoring.pollLocation',
        extra: { weatherLocationId: 42 },
      }),
    );
  });

  it('keeps polling the remaining locations after one fails', async () => {
    watching(42, 43);
    mocks.fetchLocationAlerts
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([alert('High Wind Warning')]);

    const result = await pollWatchedLocations({ env });

    expect(result).toMatchObject({ checked: 2, failed: 1, notified: 1 });
  });
});
