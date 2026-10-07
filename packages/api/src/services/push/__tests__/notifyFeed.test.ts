import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tags = vi.fn();
  const settingsWhere = vi.fn();
  const tokensWhere = vi.fn();
  const deleteWhere = vi.fn();
  const tables = { socialSettings: { tag: 'socialSettings' }, userDeviceTokens: { tag: 'tokens' } };
  return {
    tables,
    tags,
    settingsWhere,
    tokensWhere,
    deleteWhere,
    env: { APNS_KEY_ID: 'k' },
    sendApnsPush: vi.fn(),
    captureApiException: vi.fn(),
    waitUntil: vi.fn(),
    cloudflare: { mode: 'stub' as 'stub' | 'waitUntil' | 'throws' },
    createDb: vi.fn(() => {
      const db = {
        tag: (label: string) => {
          tags(label);
          return db;
        },
        select: (_cols: unknown) => ({
          from: (table: unknown) => ({
            where:
              (table as { tag?: string }).tag === 'socialSettings' ? settingsWhere : tokensWhere,
          }),
        }),
        delete: (_table: unknown) => ({ where: deleteWhere }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: () => mocks.env }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('../apnsClient', () => ({ sendApnsPush: mocks.sendApnsPush }));
vi.mock('@packrat/db/schema', () => ({
  socialSettings: {
    ...mocks.tables.socialSettings,
    userId: 'settings.userId',
  },
  userDeviceTokens: { ...mocks.tables.userDeviceTokens, id: 'tokens.id', userId: 'tokens.userId' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  inArray: vi.fn((col, vals) => ({ col, vals })),
}));
// The real `cloudflare:workers` exposes `waitUntil` only inside workerd; the
// getter lets each test pick which runtime it is in.
vi.mock('cloudflare:workers', () => ({
  get waitUntil() {
    if (mocks.cloudflare.mode === 'throws') throw new Error('no workerd');
    return mocks.cloudflare.mode === 'waitUntil' ? mocks.waitUntil : undefined;
  },
}));

import { notifyFeedRecipients, runAfterResponse } from '../notifyFeed';

const base = { kind: 'comment' as const, title: 'Ana commented', body: 'Nice', postId: 7 };

function settings(userId: string, overrides: Record<string, boolean> = {}) {
  return { userId, notifyTags: true, notifyComments: true, notifyReplies: true, ...overrides };
}

describe('notifyFeedRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settingsWhere.mockResolvedValue([]);
    mocks.tokensWhere.mockResolvedValue([{ id: 't1', deviceToken: 'device-1' }]);
    mocks.sendApnsPush.mockResolvedValue({ outcome: 'sent' });
    mocks.deleteWhere.mockResolvedValue(undefined);
  });

  it('does nothing for an empty recipient list', async () => {
    await notifyFeedRecipients({ ...base, recipientIds: [] });

    expect(mocks.createDb).toHaveBeenCalledTimes(0);
    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(0);
  });

  it('dedupes recipients before querying', async () => {
    await notifyFeedRecipients({ ...base, recipientIds: ['u1', 'u2', 'u1'] });

    expect(mocks.settingsWhere).toHaveBeenCalledWith({
      col: 'settings.userId',
      vals: ['u1', 'u2'],
    });
    expect(mocks.tokensWhere).toHaveBeenCalledWith({ col: 'tokens.userId', vals: ['u1', 'u2'] });
  });

  it('pushes the title, body and post id to each device', async () => {
    await notifyFeedRecipients({ ...base, recipientIds: ['u1'] });

    expect(mocks.sendApnsPush).toHaveBeenCalledWith({
      env: mocks.env,
      deviceToken: 'device-1',
      payload: { alert: { title: 'Ana commented', body: 'Nice' }, postId: 7 },
    });
  });

  it.each([
    ['tag', 'notifyTags'],
    ['comment', 'notifyComments'],
    ['reply', 'notifyReplies'],
  ] as const)('skips recipients who turned off %s notifications', async (kind, setting) => {
    mocks.settingsWhere.mockResolvedValue([
      settings('muted', { [setting]: false }),
      settings('listening'),
    ]);

    await notifyFeedRecipients({ ...base, kind, recipientIds: ['muted', 'listening', 'default'] });

    expect(mocks.tokensWhere).toHaveBeenCalledWith({
      col: 'tokens.userId',
      vals: ['listening', 'default'],
    });
  });

  it('only honours the opt-out for the kind being sent', async () => {
    mocks.settingsWhere.mockResolvedValue([settings('u1', { notifyTags: false })]);

    await notifyFeedRecipients({ ...base, kind: 'reply', recipientIds: ['u1'] });

    expect(mocks.tokensWhere).toHaveBeenCalledWith({ col: 'tokens.userId', vals: ['u1'] });
  });

  it('stops before loading devices when everyone opted out', async () => {
    mocks.settingsWhere.mockResolvedValue([settings('u1', { notifyComments: false })]);

    await notifyFeedRecipients({ ...base, recipientIds: ['u1'] });

    expect(mocks.tokensWhere).toHaveBeenCalledTimes(0);
    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(0);
  });

  it('deletes a token APNs reports as invalid', async () => {
    mocks.sendApnsPush.mockResolvedValue({ outcome: 'invalid-token' });

    await notifyFeedRecipients({ ...base, recipientIds: ['u1'] });

    expect(mocks.deleteWhere).toHaveBeenCalledWith({ col: 'tokens.id', val: 't1' });
    expect(mocks.tags).toHaveBeenCalledWith('feed.notify.deleteStaleDeviceToken');
  });

  it('reports an APNs error with its status, keeping the token', async () => {
    mocks.sendApnsPush.mockResolvedValue({ outcome: 'error', status: 500, body: 'boom' });

    await notifyFeedRecipients({ ...base, recipientIds: ['u1'] });

    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'feed.notifyFeedRecipients',
        extra: { postId: 7, kind: 'comment', httpStatus: 500 },
      }),
    );
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(0);
  });

  it('captures a thrown send and keeps delivering to the other devices', async () => {
    const failure = new Error('network down');
    mocks.tokensWhere.mockResolvedValue([
      { id: 't1', deviceToken: 'device-1' },
      { id: 't2', deviceToken: 'device-2' },
    ]);
    mocks.sendApnsPush.mockRejectedValueOnce(failure).mockResolvedValueOnce({ outcome: 'sent' });

    await notifyFeedRecipients({ ...base, recipientIds: ['u1'] });

    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ error: failure, extra: { postId: 7, kind: 'comment' } }),
    );
    expect(mocks.sendApnsPush.mock.calls[1]?.[0]).toMatchObject({ deviceToken: 'device-2' });
  });

  it('captures a database failure instead of throwing', async () => {
    const failure = new Error('db down');
    mocks.settingsWhere.mockRejectedValue(failure);

    await expect(notifyFeedRecipients({ ...base, recipientIds: ['u1'] })).resolves.toBeUndefined();
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ error: failure, operation: 'feed.notifyFeedRecipients' }),
    );
  });
});

describe('runAfterResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hands the task to waitUntil inside workerd', async () => {
    mocks.cloudflare.mode = 'waitUntil';
    const task = vi.fn(async () => {});

    await runAfterResponse(task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(mocks.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it.each([
    'stub',
    'throws',
  ] as const)('runs the task inline outside workerd (%s)', async (mode) => {
    mocks.cloudflare.mode = mode;
    const order: string[] = [];

    await runAfterResponse(async () => {
      await Promise.resolve();
      order.push('task');
    });
    order.push('after');

    expect(order).toEqual(['task', 'after']);
    expect(mocks.waitUntil).toHaveBeenCalledTimes(0);
  });
});
