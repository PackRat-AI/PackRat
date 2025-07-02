import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function LoginLayout() {
  return <Stack screenOptions={SCREEN_OPTIONS} />;
}

const SCREEN_OPTIONS = {
  headerShown: Platform.OS === 'ios',
} as const;
