import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { View } from 'react-native';

export function LoadingSpinnerScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  );
}
