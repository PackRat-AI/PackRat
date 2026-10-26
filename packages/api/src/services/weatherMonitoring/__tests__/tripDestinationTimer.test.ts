import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {} as { TRIP_DESTINATION_WATCHER?: unknown },
  upcoming: [] as unknown[],
  captureApiException: vi.fn(),
  arm: vi.fn(),
  disarm: vi.fn(),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: () => mocks.env }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('@packrat/api/db', () => ({
  createDbClient: () => ({
    tag: () => ({ select: () => ({ from: () => ({ where: async () => mocks.upcoming }) }) }),
  }),
}));

const { disarmTripDestinationTimer, rearmTripDestinationTimers, syncTripDestinationTimer } =
  await import('../tripDestinationTimer');

/** A fake namespace whose every timer shares the `arm`/`disarm` spies. */
function fakeNamespace() {
  const namespace = {
    idFromName: vi.fn((name: string) => `id:${name}`),
    get: vi.fn(() => ({ arm: mocks.arm, disarm: mocks.disarm })),
  };
  mocks.env = { TRIP_DESTINATION_WATCHER: namespace };
  return namespace;
}

const DAY = 24 * 60 * 60 * 1000;
const START = new Date('2026-10-20T12:00:00Z');
const NOW = START.getTime() - 3 * DAY;
const location = { latitude: 36.27, longitude: -121.8, name: 'Big Sur' };

function trip(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    userId: 'user-1',
    name: `Trip ${id}`,
    deleted: false,
    location,
    startDate: START,
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env = {};
  mocks.upcoming = [];
});

describe('syncTripDestinationTimer', () => {
  it("arms the trip's own timer with its current details", async () => {
    const namespace = fakeNamespace();
    await syncTripDestinationTimer({ trip: trip('t1'), now: NOW });
    expect(namespace.idFromName).toHaveBeenCalledWith('t1');
    expect(mocks.arm).toHaveBeenCalledWith({
      tripId: 't1',
      userId: 'user-1',
      name: 'Trip t1',
      location,
      startDate: START.getTime(),
    });
  });

  it('clears the timer when the trip has nothing to watch', async () => {
    fakeNamespace();
    await syncTripDestinationTimer({ trip: trip('t1', { location: null }), now: NOW });
    expect(mocks.disarm).toHaveBeenCalledTimes(1);
    expect(mocks.arm).toHaveBeenCalledTimes(0);
  });

  it('does nothing without the binding', async () => {
    await syncTripDestinationTimer({ trip: trip('t1'), now: NOW });
    expect(mocks.arm).toHaveBeenCalledTimes(0);
  });

  it('captures a failure instead of failing the trip write', async () => {
    fakeNamespace();
    mocks.arm.mockRejectedValueOnce(new Error('do down'));
    await expect(syncTripDestinationTimer({ trip: trip('t1'), now: NOW })).resolves.toBeUndefined();
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'tripReminders.syncDestinationTimer',
        extra: { tripId: 't1' },
      }),
    );
  });
});

describe('disarmTripDestinationTimer', () => {
  it("clears the trip's timer", async () => {
    const namespace = fakeNamespace();
    await disarmTripDestinationTimer({ tripId: 't1' });
    expect(namespace.idFromName).toHaveBeenCalledWith('t1');
    expect(mocks.disarm).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the binding', async () => {
    await disarmTripDestinationTimer({ tripId: 't1' });
    expect(mocks.disarm).toHaveBeenCalledTimes(0);
  });

  it('captures a failure instead of failing the delete', async () => {
    fakeNamespace();
    mocks.disarm.mockRejectedValueOnce(new Error('do down'));
    await expect(disarmTripDestinationTimer({ tripId: 't1' })).resolves.toBeUndefined();
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'tripReminders.disarmDestinationTimer',
        extra: { tripId: 't1' },
      }),
    );
  });
});

describe('rearmTripDestinationTimers', () => {
  it('arms every upcoming trip with a destination', async () => {
    fakeNamespace();
    mocks.upcoming = [trip('t1'), trip('t2')];
    const result = await rearmTripDestinationTimers({ env: mocks.env as ValidatedEnv, now: NOW });
    expect(result).toEqual({ armed: 2 });
    expect(mocks.arm).toHaveBeenCalledWith(expect.objectContaining({ tripId: 't2' }));
  });

  it('skips a row that no longer needs watching', async () => {
    fakeNamespace();
    mocks.upcoming = [trip('t1', { startDate: null })];
    const result = await rearmTripDestinationTimers({ env: mocks.env as ValidatedEnv, now: NOW });
    expect(result).toEqual({ armed: 0 });
  });

  it('arms nothing without the binding', async () => {
    mocks.upcoming = [trip('t1')];
    const result = await rearmTripDestinationTimers({ env: {} as ValidatedEnv, now: NOW });
    expect(result).toEqual({ armed: 0 });
    expect(mocks.arm).toHaveBeenCalledTimes(0);
  });
});
