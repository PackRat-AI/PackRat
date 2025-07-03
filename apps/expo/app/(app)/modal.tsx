import { StatusBar } from 'expo-status-bar';
import { Platform, ScrollView, View } from 'react-native';

import { Text } from '~/components/nativewindui/Text';
import { DeleteAccountButton } from '~/features/auth/components/DeleteAccountButton';
import { useAuth } from '~/features/auth/hooks/useAuth';
import { useColorScheme } from '~/lib/hooks/useColorScheme';

export default function ModalScreen() {
  const { colorScheme } = useColorScheme();
  const { isAuthenticated } = useAuth();

  return (
    <ScrollView className="flex-1 px-4 py-6">
      <View className="gap-6">
        <StatusBar
          style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
        />

        {isAuthenticated && (
          <View>
            <Text variant="subhead" className="mb-4">
              Danger Zone
            </Text>
            <DeleteAccountButton />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
