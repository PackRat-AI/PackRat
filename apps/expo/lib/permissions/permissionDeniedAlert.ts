import { showAlert } from '@packrat/ui/src/alert-host';
import {
  type DeniedPermission,
  isPermissionDeniedError,
  PERMISSION_DENIED_COPY,
} from 'expo-app/lib/utils/permissionDenied';
import i18next from 'i18next';
import { Linking } from 'react-native';

/** Says which access is off and offers the way to turn it back on. */
export function showPermissionDeniedAlert(permission: DeniedPermission): void {
  const copy = PERMISSION_DENIED_COPY[permission];
  showAlert({
    title: i18next.t(copy.title),
    message: i18next.t(copy.message),
    buttons: [
      { text: i18next.t('common.cancel'), style: 'cancel' },
      { text: i18next.t('permissions.openSettings'), onPress: () => void Linking.openSettings() },
    ],
  });
}

/**
 * Shows the Settings dialog when an image picker failed on a refused permission. Returns whether it
 * did, so the caller handles every other failure as it already does.
 */
export function handlePermissionDenied(error: unknown): boolean {
  if (!isPermissionDeniedError(error)) return false;
  showPermissionDeniedAlert(error.permission);
  return true;
}
