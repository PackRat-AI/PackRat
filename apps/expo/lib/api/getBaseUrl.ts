import { Platform } from 'react-native';

/**
 * Android emulators route `localhost` to the emulator itself, not the host.
 * Rewrite localhost → 10.0.2.2 so dev API calls reach the host machine.
 * No-op on iOS and in production (non-localhost URLs are returned unchanged).
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (Platform.OS === 'android') {
    return url.split('localhost').join('10.0.2.2');
  }
  return url;
}
