import { Button as ExpoButton, Host } from '@expo/ui';
import { isString } from '@packrat/guards';
import { cssInterop } from 'nativewind';
import { Children, isValidElement, type ReactNode } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { shouldMatchContents } from './lib/text-class-parser';
import { Text } from './text';

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

/**
 * Extracts a plain string label when `children` is exactly one `Text` (or raw string) with
 * only string content, so Button can use @expo/ui's `label` prop instead of nesting a Text's
 * own Host inside Button's Host. Two independent native-bridge Hosts can't correctly report
 * intrinsic size across that boundary — nesting them collapsed the button to near-zero size
 * with its label overflowing outside, confirmed on-device. Anything more complex (icon+text,
 * multiple children) falls through to `children` unchanged — still nested-Host-risky, a known
 * gap, but rare relative to the plain-text-label case this fixes.
 */
function extractLabel(children: ReactNode): string | undefined {
  const kids = Children.toArray(children);
  if (kids.length !== 1) return undefined;
  const only = kids[0];
  if (isString(only)) return only;
  if (isValidElement(only) && only.type === Text) {
    const inner = (only.props as { children?: ReactNode }).children;
    return isString(inner) ? inner : undefined;
  }
  return undefined;
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
  accessibilityHint?: string;
  accessibilityLabel?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
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
  accessibilityHint,
  accessibilityLabel,
  onLayout,
  style,
  testID,
}: ButtonProps) {
  const resolvedLabel = label ?? extractLabel(children);
  return (
    // matchContents only when className has no explicit sizing (flex-1, w-*, h-*, ...) — those
    // need Yoga to size the box; everything else needs matchContents or it collapses to zero
    // height (Host has no other size signal without a native-content-driven size).
    <Host
      matchContents={shouldMatchContents(className)}
      className={className}
      style={[SIZE_STYLE[size], style]}
      accessible={accessible}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      testID={testID}
    >
      <ExpoButton
        label={resolvedLabel}
        onPress={onPress}
        variant={resolveVariant(variant)}
        disabled={disabled}
      >
        {resolvedLabel === undefined ? children : undefined}
      </ExpoButton>
    </Host>
  );
}

export { Button };
export type { ButtonProps, ButtonSize, ButtonVariant };
