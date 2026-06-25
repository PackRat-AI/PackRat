import { Platform } from 'react-native';
import { AppBarAndroid } from './AppBarAndroid';

type AppBarAndroidProps = React.ComponentProps<typeof AppBarAndroid>;

/**
 * Returns Stack.Screen options that render a platform-native large-title header:
 * - iOS:     native headerLargeTitle (collapses on scroll automatically)
 * - Android: fixed MD3 Large Top App Bar (no collapse)
 *
 * Usage:
 *   <Stack.Screen options={{ ...getAppBarOptions(), title: 'Dashboard' }} />
 */
export function getAppBarOptions() {
  if (Platform.OS !== 'android') {
    return {
      headerLargeTitle: true,
      headerBackButtonDisplayMode: 'minimal' as const,
    };
  }

  return {
    header: (props: AppBarAndroidProps) => <AppBarAndroid {...props} />,
    headerShown: true,
  };
}
