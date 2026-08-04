import { Host as SwiftUIHost, Toggle as SwiftUIToggle } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import type { ComponentProps } from 'react';
import type { ToggleProps } from './toggle-props';

cssInterop(SwiftUIHost, { className: 'style' });

// See toggle.android.tsx — swift-ui's Host prop type doesn't extend RN's ViewProps, so the
// cssInterop call is what actually makes className work and this cast tells TS so.
type HostProps = ComponentProps<typeof SwiftUIHost> & { className?: string };
const Host = SwiftUIHost as (props: HostProps) => ReturnType<typeof SwiftUIHost>;

/**
 * SwiftUI `Toggle`, replacing React Native core's `Switch`. See toggle.android.tsx for why this
 * leaf-control shape works where wrapping containers does not.
 *
 * No `label` is passed: the call sites render their own RN `Text` beside the control, and a
 * SwiftUI label here would double it up.
 */
function Toggle({ value, onValueChange, disabled, className, style }: ToggleProps) {
  const { colors } = useColorScheme();
  return (
    <Host matchContents className={className} style={style}>
      <SwiftUIToggle
        isOn={value ?? false}
        onIsOnChange={disabled ? undefined : onValueChange}
        modifiers={[tint(colors.primary)]}
      />
    </Host>
  );
}

export { Toggle };
export type { ToggleProps };
