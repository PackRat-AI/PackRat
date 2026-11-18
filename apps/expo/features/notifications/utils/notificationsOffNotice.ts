/**
 * Whether to show the notifications-off notice beside a trip alerts control:
 * only once the permission is known to be off, and only where alerts are on,
 * since an alert that is switched off has nothing to miss.
 */
export function showsNotificationsOffNotice({
  granted,
  alertsOn,
}: {
  granted: boolean | undefined;
  alertsOn: boolean;
}): boolean {
  return alertsOn && granted === false;
}
