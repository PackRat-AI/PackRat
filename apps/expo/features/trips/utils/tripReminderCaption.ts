/** What sits under a trip's Trip Reminders switch. */
export type TripReminderCaption = 'offInSettings' | 'notificationsOff' | 'nextReminder' | null;

/**
 * Reminders switched off app-wide say so; a trip that wants reminders on a phone that blocks
 * notifications says that instead of promising a reminder that can't arrive. A permission still
 * being checked (`null`) shows the next reminder rather than flashing a warning.
 */
export function tripReminderCaption({
  enabled,
  muted,
  notificationsGranted,
}: {
  enabled: boolean;
  muted: boolean;
  notificationsGranted: boolean | null;
}): TripReminderCaption {
  if (!enabled) return 'offInSettings';
  if (muted) return null;
  if (notificationsGranted === false) return 'notificationsOff';
  return 'nextReminder';
}
