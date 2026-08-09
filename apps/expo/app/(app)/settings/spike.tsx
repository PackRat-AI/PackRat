import { Text } from '@packrat/ui/src/text';
import { View } from 'react-native';

/**
 * SPIKE fallback — delete with `spike.ios.tsx` and `spike.android.tsx`.
 *
 * Expo Router requires a platform-extension route to have a sibling *without* a platform
 * extension, or routing fails outright at runtime:
 *
 *   Error: The file ./(app)/settings/spike.android.tsx does not have a fallback sibling file
 *   without a platform extension.
 *
 * Worth recording as a cost of the platform-split approach: every natively-implemented screen is
 * three files (ios, android, fallback), not two. @expo/ui has no web target, so on web the choice
 * is a hand-written RN implementation or nothing — which means a third real implementation for any
 * screen that has to work on web.
 */
export default function SettingsDisplayUnitsSpikeFallback() {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-center text-muted-foreground" wrap>
        This spike is implemented natively for iOS (SwiftUI) and Android (Jetpack Compose) only.
      </Text>
    </View>
  );
}
