import { Button as ExpoButton, Host } from '@expo/ui';
import { cssInterop } from 'nativewind';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { shouldMatchContents } from './lib/text-class-parser';

cssInterop(Host, { className: 'style' });

// Legacy NativeWindUI variant names, kept so call sites don't need rewriting.
type LegacyButtonVariant = 'primary' | 'secondary' | 'tonal' | 'plain';
type ButtonVariant = 'filled' | 'outlined' | 'text' | LegacyButtonVariant;
type ButtonSize = 'none' | 'sm' | 'md' | 'lg' | 'icon';

const VARIANT_MAP: Record<LegacyButtonVariant, 'filled' | 'outlined' | 'text'> = {
  primary: 'filled',
  secondary: 'outlined',
  tonal: 'outlined',
  plain: 'text',
};

// Approximates the old cva size classes (py/px) as a fixed style, since @expo/ui Button has
// no size prop — only style's padding/width/height reach the Host box.
const SIZE_STYLE: Record<ButtonSize, ViewStyle> = {
  none: {},
  sm: { paddingVertical: 4, paddingHorizontal: 10 },
  md: { paddingVertical: 8, paddingHorizontal: 14 },
  lg: { paddingVertical: 10, paddingHorizontal: 20 },
  icon: { width: 40, height: 40 },
};

function resolveVariant(variant: ButtonVariant): 'filled' | 'outlined' | 'text' {
  return variant in VARIANT_MAP
    ? VARIANT_MAP[variant as LegacyButtonVariant]
    : (variant as 'filled' | 'outlined' | 'text');
}

type ButtonProps = {
  children?: ReactNode;
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  /** ANDROID ONLY on the old API — no @expo/ui equivalent (Host has no ripple-overflow root). Accepted and ignored. */
  androidRootClassName?: string;
  accessible?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function Button({
  children,
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  accessible,
  style,
  testID,
}: ButtonProps) {
  return (
    // matchContents only when className has no explicit sizing (flex-1, w-*, h-*, ...) — those
    // need Yoga to size the box; everything else needs matchContents or it collapses to zero
    // height (Host has no other size signal without a native-content-driven size).
    <Host
      matchContents={shouldMatchContents(className)}
      className={className}
      style={[SIZE_STYLE[size], style]}
      accessible={accessible}
      testID={testID}
    >
      <ExpoButton
        label={label}
        onPress={onPress}
        variant={resolveVariant(variant)}
        disabled={disabled}
      >
        {children}
      </ExpoButton>
    </Host>
  );
}

export { Button };
export type { ButtonProps, ButtonSize, ButtonVariant };
