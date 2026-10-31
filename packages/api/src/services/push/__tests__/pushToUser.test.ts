import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectWhere = vi.fn();
  const deleteWhere = vi.fn();
  const db = {
    tag: (_label: string) => db,
    select: (_cols: unknown) => ({ from: (_table: unknown) => ({ where: selectWhere }) }),
    delete: (_table: unknown) => ({ where: deleteWhere }),
  };
  return { selectWhere, deleteWhere, db, sendPush: vi.fn(), captureApiException: vi.fn() };
});

vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('../sendPush', () => ({
  sendPush: mocks.sendPush,
  pushGateway: (platform: string) => (platform === 'android' ? 'FCM' : 'APNs'),
}));

import { pushToUser } from '../pushToUser';

const payload = { alert: { title: 'T', body: 'B' }, tripId: 'trip-1' };
const send = () =>
  pushToUser({
    env: {} as ValidatedEnv,
    db: mocks.db as unknown as Parameters<typeof pushToUser>[0]['db'],
    userId: 'u1',
    payload,
    operation: 'test.push',
    extra: { tripId: 'trip-1' },
  });

describe('pushToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectWhere.mockResolvedValue([
      { id: 't1', platform: 'ios', deviceToken: 'device-1' },
      { id: 't2', platform: 'android', deviceToken: 'device-2' },
    ]);
    mocks.sendPush.mockResolvedValue({ outcome: 'sent' });
  });

  it('sends the payload to every device of the user', async () => {
    await send();
    expect(mocks.sendPush.mock.calls.map((c) => [c[0].deviceToken, c[0].payload])).toEqual([
      ['device-1', payload],
      ['device-2', payload],
    ]);
  });

  it('deletes a token the gateway says is gone', async () => {
    mocks.sendPush.mockResolvedValueOnce({ outcome: 'invalid-token' });
    await send();
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
    expect(mocks.sendPush).toHaveBeenCalledTimes(2);
  });

  it('reports a gateway error with its status and keeps going', async () => {
    mocks.sendPush.mockResolvedValueOnce({ outcome: 'error', status: 500, body: 'boom' });
    await send();
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'test.push',
        extra: { tripId: 'trip-1', httpStatus: 500 },
      }),
    );
    expect(mocks.sendPush).toHaveBeenCalledTimes(2);
  });

  it('reports a thrown send and keeps going', async () => {
    const error = new Error('network');
    mocks.sendPush.mockRejectedValueOnce(error);
    await send();
    expect(mocks.captureApiException).toHaveBeenCalledWith({
      error,
      operation: 'test.push',
      extra: { tripId: 'trip-1' },
    });
    expect(mocks.sendPush).toHaveBeenCalledTimes(2);
  });
});
