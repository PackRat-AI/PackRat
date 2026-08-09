import { Checkbox as JCCheckbox, Host as JCHost } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { useControllableState } from '@rn-primitives/hooks';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import type { ComponentProps } from 'react';
import type { CheckboxProps } from './checkbox-props';

cssInterop(JCHost, { className: 'style' });

// jetpack-compose's Host prop type doesn't extend RN's ViewProps, so NativeWind's global
// className→style augmentation never reaches it. The cssInterop call above makes className work at
// runtime; this widened type tells TS the same. Same recipe as toggle.android.tsx.
type HostProps = ComponentProps<typeof JCHost> & { className?: string };
const Host = JCHost as (props: HostProps) => ReturnType<typeof JCHost>;

/**
 * Material 3 `Checkbox`, replacing the `@rn-primitives/checkbox` + `Icon` composition.
 *
 * Leaf-control shape: one `Host` around a self-contained native control with no RN children, sized
 * by `matchContents`, so it drops into the existing RN rows unchanged.
 *
 * iOS deliberately keeps the RN implementation (`checkbox.tsx`) — SwiftUI has no checkbox toggle
 * style, only a switch, so routing iOS through `@expo/ui` would turn every checkbox into a switch.
 */
function Checkbox({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange: onCheckedChangeProp,
  disabled,
  className,
  style,
  testID,
}: CheckboxProps) {
  const { colors } = useColorScheme();
  const [checked = false, onCheckedChange] = useControllableState({
    prop: checkedProp,
    defaultProp: defaultChecked,
    onChange: onCheckedChangeProp,
  });

  return (
    <Host matchContents className={className} style={style}>
      <JCCheckbox
        value={checked}
        enabled={!disabled}
        onCheckedChange={onCheckedChange}
        modifiers={testID ? [testIDModifier(testID)] : undefined}
        colors={{
          checkedColor: colors.primary,
          uncheckedColor: colors.grey2,
          checkmarkColor: '#FFFFFF',
        }}
      />
    </Host>
  );
}

export { Checkbox };
export type { CheckboxProps };
