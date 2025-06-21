import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { useColorScheme } from '~/lib/useColorScheme';
import { PackListScreen } from '~/features/packs/screens/PackListScreen';

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
