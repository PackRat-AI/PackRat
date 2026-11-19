import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendIntent, openSettings, captureException, platform, expoConfig } = vi.hoisted(() => ({
  sendIntent: vi.fn(),
  openSettings: vi.fn(),
  captureException: vi.fn(),
  platform: { OS: 'android' },
  expoConfig: { android: { package: 'com.packratai.mobile' } as { package?: string } },
}));

vi.mock('react-native', () => ({ Linking: { sendIntent, openSettings }, Platform: platform }));
vi.mock('expo-constants', () => ({ default: { expoConfig } }));
vi.mock('@sentry/react-native', () => ({ captureException }));

import { openPermissionSettings } from '../openPermissionSettings';

describe('openPermissionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform.OS = 'android';
    expoConfig.android.package = 'com.packratai.mobile';
  });

  it("opens the app's notification page for notifications on Android", async () => {
    await openPermissionSettings('notifications');
    expect(sendIntent).toHaveBeenCalledWith('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: 'com.packratai.mobile' },
    ]);
    expect(openSettings).not.toHaveBeenCalled();
  });

  it("opens the app's settings page for other permissions", async () => {
    await openPermissionSettings('app');
    expect(sendIntent).not.toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('falls back to the app settings page when the notification page cannot open', async () => {
    const error = new Error('No activity');
    sendIntent.mockRejectedValueOnce(error);
    await openPermissionSettings('notifications');
    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ tags: expect.any(Object) }),
    );
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('falls back when the package name is unknown', async () => {
    expoConfig.android.package = undefined;
    await openPermissionSettings('notifications');
    expect(sendIntent).not.toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});
