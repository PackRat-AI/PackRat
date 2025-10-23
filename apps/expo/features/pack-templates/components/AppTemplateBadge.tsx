import { Text } from '@packrat/ui/nativewindui';
import { Image, View } from 'react-native';

const LOGO_SOURCE = require('expo-app/assets/adaptive-icon.png');

export function AppTemplateBadge() {
  return (
    <View className="flex-row items-center justify-between ml-auto rounded-md pr-2 bg-muted-foreground dark:bg-neutral-600">
      <Image source={LOGO_SOURCE} className="h-8 w-8 rounded-md" resizeMode="contain" />
      <Text className="text-xs text-white">App Template</Text>
    </View>
  );
}
