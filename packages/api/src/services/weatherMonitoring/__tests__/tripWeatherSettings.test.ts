import type { createDb } from '@packrat/api/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: [] as { tripWeather: boolean }[],
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
}));

vi.mock('@packrat/db/schema', () => ({
  notificationPreferences: { userId: 'userId', tripWeather: 'tripWeather' },
}));

const { getTripWeatherNotificationsEnabled, setTripWeatherNotificationsEnabled } = await import(
  '../tripWeatherSettings'
);

const db = {
  tag: () => db,
  select: () => ({ from: () => ({ where: async () => mocks.rows }) }),
  insert: () => ({
    values: (values: unknown) => {
      mocks.values(values);
      return { onConflictDoUpdate: mocks.onConflictDoUpdate };
    },
  }),
} as unknown as ReturnType<typeof createDb>; // safe-cast: minimal query-builder stub

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = [];
  mocks.onConflictDoUpdate.mockResolvedValue(undefined);
});

describe('getTripWeatherNotificationsEnabled', () => {
  it('is on for a user who never changed it', async () => {
    await expect(getTripWeatherNotificationsEnabled({ db, userId: 'u1' })).resolves.toBe(true);
  });

  it('reads the saved switch', async () => {
    mocks.rows = [{ tripWeather: false }];
    await expect(getTripWeatherNotificationsEnabled({ db, userId: 'u1' })).resolves.toBe(false);
  });
});

describe('setTripWeatherNotificationsEnabled', () => {
  it('saves the switch for the user', async () => {
    await setTripWeatherNotificationsEnabled({ db, userId: 'u1', enabled: false });
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', tripWeather: false }),
    );
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'userId',
        set: expect.objectContaining({ tripWeather: false }),
      }),
    );
  });
});
