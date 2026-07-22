import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { ComponentProps } from 'react';
import { Switch } from 'react-native';

// Plain RN Switch — already native on both platforms, no Host bridge needed. @expo/ui's
// Universal Switch is Host-bridged for no real benefit over RN core's own component here.

function Toggle(props: ComponentProps<typeof Switch>) {
  const { colors } = useColorScheme();
  return (
    <Switch
      trackColor={{
        true: colors.primary,
        false: colors.grey,
      }}
      thumbColor="#FFFFFF"
      {...props}
    />
  );
}

export { Toggle };
