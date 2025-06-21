import { View } from 'react-native';
import { ActivityIndicator } from 'nativewindui/ActivityIndicator';

export function LoadingSpinnerScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  );
}
