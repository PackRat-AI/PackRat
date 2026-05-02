import { useColorScheme } from '@packrat/app/lib/hooks/useColorScheme';
import { PackListScreen } from '@packrat/app/packs/screens/PackListScreen';
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
