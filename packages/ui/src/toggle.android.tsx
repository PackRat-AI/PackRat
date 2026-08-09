import { Host as JCHost, Switch as JCSwitch } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import type { ComponentProps } from 'react';
import type { ToggleProps } from './toggle-props';

cssInterop(JCHost, { className: 'style' });

// jetpack-compose's Host prop type doesn't extend RN's ViewProps (unlike the universal Host), so
// NativeWind's global className→style augmentation never reaches it. The cssInterop call above
// makes className work at runtime; this widened type just tells TS the truth. Same shape as
// loading-indicator.android.tsx, which is the proven recipe in this package.
type HostProps = ComponentProps<typeof JCHost> & { className?: string };
const Host = JCHost as (props: HostProps) => ReturnType<typeof JCHost>;

/**
 * Material 3 `Switch`, replacing React Native core's.
 *
 * This is the *leaf control* shape of @expo/ui adoption: one `Host` around a self-contained native
 * control with no RN children, sized by `matchContents`. It composes into the existing RN layouts
 * unchanged — no screen rewrite — because the surrounding rows are still React Native.
 *
 * Unlike RN's `Switch` (which exposes only `trackColor`/`thumbColor`) M3's exposes the full colour
 * set, so the app's own accent survives instead of the platform's dynamic palette.
 */
function Toggle({ value, onValueChange, disabled, className, style, testID }: ToggleProps) {
  const { colors } = useColorScheme();
  return (
    <Host matchContents className={className} style={style}>
      <JCSwitch
        value={value ?? false}
        enabled={!disabled}
        onCheckedChange={onValueChange}
        // The compose modifier is what surfaces the control to the accessibility tree at all:
        // without it the switch is a bare ComposeView with no child node, so it can neither be
        // selected by E2E nor read by TalkBack. Verified on-device.
        modifiers={testID ? [testIDModifier(testID)] : undefined}
        colors={{
          checkedTrackColor: colors.primary,
          checkedThumbColor: '#FFFFFF',
          uncheckedTrackColor: colors.grey,
          uncheckedThumbColor: '#FFFFFF',
        }}
      />
    </Host>
  );
}

export { Toggle };
export type { ToggleProps };
