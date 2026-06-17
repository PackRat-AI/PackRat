import { clientEnvs } from '@packrat/env/expo-client';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export function getApiBaseUrl(): string {
  const url = clientEnvs.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'android' && !Device.isDevice && url.includes('localhost')) {
    return url.split('localhost').join('10.0.2.2');
  }
  return url;
}
