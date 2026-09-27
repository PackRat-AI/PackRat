import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tags = vi.fn();
  const insertValues = vi.fn();
  const onConflictDoUpdate = vi.fn();
  return {
    tags,
    insertValues,
    onConflictDoUpdate,
    captureApiException: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (label: string) => {
          tags(label);
          return db;
        },
        insert: (_table: unknown) => ({
          values: (values: unknown) => {
            insertValues(values);
            return {
              onConflictDoUpdate: (opts: unknown) => onConflictDoUpdate(opts),
            };
          },
        }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('@packrat/db/schema', () => ({
  userDeviceTokens: { userId: 'userId', deviceToken: 'deviceToken' },
}));

import { registerDeviceToken } from '../deviceTokenService';

const request = { platform: 'ios' as const, deviceToken: 'abc123' };

describe('registerDeviceToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);
  });

  it('inserts the token against the calling user', async () => {
    await registerDeviceToken({ userId: 'user-1', request });

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        platform: 'ios',
        deviceToken: 'abc123',
      }),
    );
  });

  it('generates an id for the new row', async () => {
    await registerDeviceToken({ userId: 'user-1', request });

    const values = mocks.insertValues.mock.calls[0]?.[0] as { id: string };
    expect(values.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('is idempotent on (userId, deviceToken), bumping lastSeenAt instead of erroring', async () => {
    await registerDeviceToken({ userId: 'user-1', request });

    const opts = mocks.onConflictDoUpdate.mock.calls[0]?.[0] as {
      target: unknown[];
      set: { lastSeenAt: Date };
    };
    expect(opts.target).toEqual(['userId', 'deviceToken']);
    expect(opts.set.lastSeenAt).toBeInstanceOf(Date);
  });

  it('tags the query so it is attributable in Neon logs', async () => {
    await registerDeviceToken({ userId: 'user-1', request });

    expect(mocks.tags).toHaveBeenCalledWith('weatherMonitoring.registerDeviceToken');
  });

  it('reports the failure to Sentry with the user attached, then rethrows', async () => {
    const failure = new Error('unique violation');
    mocks.onConflictDoUpdate.mockRejectedValue(failure);

    await expect(registerDeviceToken({ userId: 'user-1', request })).rejects.toThrow(
      'unique violation',
    );
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        error: failure,
        operation: 'weatherMonitoring.registerDeviceToken',
        userId: 'user-1',
      }),
    );
  });
});
