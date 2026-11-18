import { describe, expect, it } from 'vitest';
import { tripReminderCaption } from '../tripReminderCaption';

describe('tripReminderCaption', () => {
  it('says reminders are off in Settings before anything else', () => {
    expect(tripReminderCaption({ enabled: false, muted: false, notificationsGranted: false })).toBe(
      'offInSettings',
    );
  });

  it('shows nothing for a trip the user muted', () => {
    expect(tripReminderCaption({ enabled: true, muted: true, notificationsGranted: false })).toBe(
      null,
    );
  });

  it('says notifications are off when the phone blocks them', () => {
    expect(tripReminderCaption({ enabled: true, muted: false, notificationsGranted: false })).toBe(
      'notificationsOff',
    );
  });

  it('shows the next reminder when notifications are allowed or not yet checked', () => {
    expect(tripReminderCaption({ enabled: true, muted: false, notificationsGranted: true })).toBe(
      'nextReminder',
    );
    expect(tripReminderCaption({ enabled: true, muted: false, notificationsGranted: null })).toBe(
      'nextReminder',
    );
  });
});
