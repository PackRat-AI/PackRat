import { ActivityIndicator } from '@packrat/ui/nativewindui';
import { View } from 'react-native';

export function LoadingSpinnerScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  );
}
