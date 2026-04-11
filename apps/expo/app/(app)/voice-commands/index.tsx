import { VoiceCommandScreen } from 'expo-app/features/voice/screens/VoiceCommandScreen';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

export default function VoiceCommandsRoute() {
  const { colorScheme } = useColorScheme();

  return (
    <>
      <StatusBar
        style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
      />
      <VoiceCommandScreen />
    </>
  );
}
