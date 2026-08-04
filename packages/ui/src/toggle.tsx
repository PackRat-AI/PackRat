import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Switch } from 'react-native';
import type { ToggleProps } from './toggle-props';

/**
 * Web/fallback implementation — the platform builds use `toggle.ios.tsx` (SwiftUI `Toggle`) and
 * `toggle.android.tsx` (Material 3 `Switch`).
 *
 * `@expo/ui` has no web target, and `apps/expo` does build for web (react-native-web, the `web`
 * script, several `.web.tsx` files), so every natively-implemented component needs a real RN
 * fallback rather than a stub. For a leaf control that is one small file shared by every screen —
 * which is exactly why leaf-level adoption is cheap where screen-level adoption is not.
 */
function Toggle({ value, onValueChange, disabled, style }: ToggleProps) {
  const { colors } = useColorScheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      style={style}
      trackColor={{ true: colors.primary, false: colors.grey }}
      thumbColor="#FFFFFF"
    />
  );
}

export { Toggle };
export type { ToggleProps };
