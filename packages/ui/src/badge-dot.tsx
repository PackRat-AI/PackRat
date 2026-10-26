import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { View } from 'react-native';
import type { BadgeDotProps } from './badge-dot-props';

/**
 * Fallback for platforms without the native badge (`badge-dot.android.tsx`):
 * the same 6dp dot in the error colour.
 */
function BadgeDot({ className, style, testID }: BadgeDotProps) {
  const { colors } = useColorScheme();
  return (
    <View
      testID={testID}
      className={className}
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.destructive }, style]}
    />
  );
}

export { BadgeDot };
export type { BadgeDotProps };
