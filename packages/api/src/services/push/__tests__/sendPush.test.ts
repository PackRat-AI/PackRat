import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendApnsPush: vi.fn(),
  sendFcmPush: vi.fn(),
}));

vi.mock('../apnsClient', () => ({ sendApnsPush: mocks.sendApnsPush }));
vi.mock('../fcmClient', () => ({ sendFcmPush: mocks.sendFcmPush }));

import { pushGateway, sendPush } from '../sendPush';

const env = {} as ValidatedEnv;
const payload = { alert: { title: 'Flood Warning', body: 'Rising water' }, weatherLocationId: 42 };

describe('sendPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendApnsPush.mockResolvedValue({ outcome: 'sent' });
    mocks.sendFcmPush.mockResolvedValue({ outcome: 'invalid-token' });
  });

  it('delivers to an iOS device through APNs', async () => {
    const result = await sendPush({ env, platform: 'ios', deviceToken: 'apns-1', payload });

    expect(result).toEqual({ outcome: 'sent' });
    expect(mocks.sendApnsPush).toHaveBeenCalledWith({ env, deviceToken: 'apns-1', payload });
    expect(mocks.sendFcmPush).toHaveBeenCalledTimes(0);
  });

  it('delivers to an Android device through FCM', async () => {
    const result = await sendPush({ env, platform: 'android', deviceToken: 'fcm-1', payload });

    expect(result).toEqual({ outcome: 'invalid-token' });
    expect(mocks.sendFcmPush).toHaveBeenCalledWith({ env, deviceToken: 'fcm-1', payload });
    expect(mocks.sendApnsPush).toHaveBeenCalledTimes(0);
  });
});

describe('pushGateway', () => {
  it('names the gateway each platform uses', () => {
    expect(pushGateway('ios')).toBe('APNs');
    expect(pushGateway('android')).toBe('FCM');
  });
});
