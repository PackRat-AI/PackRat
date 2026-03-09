import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Hook to get safe insets that account for Android system navigation bar.
 *
 * On Android with absolute navigation bar positioning, content at the bottom
 * of the screen can be overlapped by the system navigation buttons.
 * Use this hook to add proper padding.
 *
 * @example
 * const insets = useAndroidSafeInsets();
 *
 * // Add bottom padding to scroll view
 * <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }} />
 *
 * // Or for fixed bottom buttons
 * <View style={{ paddingBottom: insets.bottom }}>
 *   <Button>Action</Button>
 * </View>
 */
export function useAndroidSafeInsets() {
  const insets = useSafeAreaInsets();

  return {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
    // Extra padding for Android navigation bar when using absolute positioning
    bottomWithNav: Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom,
  };
}
