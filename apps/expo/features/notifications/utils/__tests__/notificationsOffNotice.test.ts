import { describe, expect, it } from 'vitest';
import { showsNotificationsOffNotice } from '../notificationsOffNotice';

describe('showsNotificationsOffNotice', () => {
  it('shows when notifications are off and alerts are on', () => {
    expect(showsNotificationsOffNotice({ granted: false, alertsOn: true })).toBe(true);
  });

  it('hides when notifications are on', () => {
    expect(showsNotificationsOffNotice({ granted: true, alertsOn: true })).toBe(false);
  });

  it('hides while the permission is still being read', () => {
    expect(showsNotificationsOffNotice({ granted: undefined, alertsOn: true })).toBe(false);
  });

  it('hides when the alerts are switched off', () => {
    expect(showsNotificationsOffNotice({ granted: false, alertsOn: false })).toBe(false);
  });
});
