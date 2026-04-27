import { PackListScreen } from 'app/features/packs/screens/PackListScreen';
import { useColorScheme } from 'app/lib/hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

export default function PacksScreen() {
  const { colorScheme } = useColorScheme();

  return (
    <>
      <StatusBar
        style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
      />
      <PackListScreen />
    </>
  );
}
