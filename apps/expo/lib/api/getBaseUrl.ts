import { clientEnvs } from '@packrat/env/expo-client';
import { Platform } from 'react-native';

export function getApiBaseUrl(): string {
  const url = clientEnvs.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'android') {
    return url.split('localhost').join('10.0.2.2');
  }
  return url;
}
