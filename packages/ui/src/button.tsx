import { isString } from '@packrat/guards';
import { cn } from 'expo-app/lib/cn';
import { Children, isValidElement, type ReactNode } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  type View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { Text } from './text';

// Legacy NativeWindUI variant names, kept so call sites don't need rewriting.
type LegacyButtonVariant = 'primary' | 'secondary' | 'tonal' | 'plain';
type ButtonVariant = 'filled' | 'outlined' | 'text' | LegacyButtonVariant;
type ButtonSize = 'none' | 'sm' | 'md' | 'lg' | 'icon';

/**
 * The legacy names are kept as distinct styles rather than folded into the three @expo/ui
 * variants. `tonal` in particular is a *filled* muted button in the pre-migration design (the
 * auth screen's "Sign In"), which collapsing it to `outlined` visibly changed.
 */
type ResolvedVariant = 'filled' | 'outlined' | 'tonal' | 'text';

const VARIANT_MAP: Record<LegacyButtonVariant, ResolvedVariant> = {
  primary: 'filled',
  secondary: 'outlined',
  tonal: 'tonal',
  plain: 'text',
};

// Approximates the old cva size classes (py/px) as a fixed style.
const SIZE_STYLE: Record<ButtonSize, ViewStyle> = {
  none: {},
  sm: { paddingVertical: 4, paddingHorizontal: 10 },
  md: { paddingVertical: 8, paddingHorizontal: 14 },
  lg: { paddingVertical: 10, paddingHorizontal: 20 },
  icon: { width: 40, height: 40 },
};

const PRESSED_STYLE: ViewStyle = { opacity: 0.7 };

const BASE_CLASS = 'flex-row items-center justify-center rounded-full';

const VARIANT_CLASS: Record<ResolvedVariant, string> = {
  filled: `${BASE_CLASS} bg-primary`,
  outlined: `${BASE_CLASS} border border-border`,
  tonal: `${BASE_CLASS} bg-primary/10 dark:bg-primary/25`,
  text: BASE_CLASS,
};

const LABEL_CLASS: Record<ResolvedVariant, string> = {
  filled: 'text-primary-foreground font-medium',
  outlined: 'text-foreground font-medium',
  tonal: 'text-primary font-medium',
  text: 'text-primary font-medium',
};

function resolveVariant(variant: ButtonVariant): ResolvedVariant {
  // `in` doesn't narrow a string-literal union by membership the way a discriminated object
  // union does — ButtonVariant minus LegacyButtonVariant is exactly 'filled'|'outlined'|'text',
  // all of which are also ResolvedVariant members; that is what the `in` check verifies at runtime.
  return variant in VARIANT_MAP
    ? // safe-cast: see function-level comment above
      VARIANT_MAP[variant as LegacyButtonVariant]
    : (variant as ResolvedVariant);
}

/** Unwraps `<Button><Text>Save</Text></Button>` to the string `'Save'`. */
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
  /** ANDROID ONLY on the old API — no equivalent here (no ripple-overflow root). Accepted and ignored. */
  androidRootClassName?: string;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  /**
   * Required by the `@rn-primitives` menu/dialog primitives: they inject a ref through `Slot` and
   * call `.measure()` on it to position their portal. Dropping it left `triggerPosition` null and
   * the portal never rendered — that is why the Android category DropdownMenu never opened.
   */
  ref?: React.Ref<View>;
  /**
   * Every other RN View prop (role, nativeID, accessibility*, aria-*, ...). `asChild` primitives
   * inject role/accessibilityState/nativeID here, so these must reach the underlying view or
   * screen readers announce menu rows as bare buttons with no checked/disabled state.
   */
} & Omit<ViewProps, 'style' | 'children' | 'onLayout' | 'ref'>;

/**
 * A plain React Native `Pressable`, deliberately NOT `@expo/ui`'s Button.
 *
 * @expo/ui's Button renders through `Host`, a bridge to a native SwiftUI/Compose surface. That
 * turned out to be unworkable for this app's call sites, for three reasons found on-device:
 *
 * 1. **Sizing is unsolvable in the general case.** `Host` has no RN-side intrinsic size, so any
 *    axis it doesn't `matchContents` collapses to zero. Matching both axes shrink-wraps every
 *    full-width CTA to its label; matching only the vertical axis fixes those but collapses the
 *    width of buttons in a `flex-row` (the alert's "Got it" rendered one character per line).
 *    A component cannot know its parent's flex direction, so no single default is correct.
 * 2. **Non-text children don't work on Android at all.** @expo/ui hands `children` straight to a
 *    Compose composable; the hosted RN view then swallows the touch and Compose's `onClick` never
 *    fires. Icon buttons rendered but were dead, which broke every DropdownMenu trigger.
 * 3. **The label can't be styled.** @expo/ui's Button paints its own label from the platform
 *    palette, so brand colors and per-variant label colors were silently dropped.
 *
 * A Pressable has an intrinsic size, keeps touches/refs/layout in the RN tree, and lets Yoga size
 * it exactly like the NativeWindUI Button it replaces. This matches what the rest of this package
 * already concluded — Alert, Sheet, Form, TextField, List, ContextMenu, DropdownMenu and Toolbar
 * are all plain RN composition too. The tradeoff is that filled buttons no longer use the native
 * Material/SwiftUI button styling; they use the app's own brand tokens, which is what the
 * pre-migration build looked like.
 */
function Button({
  children,
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  androidRootClassName: _androidRootClassName,
  style,
  ...viewProps
}: ButtonProps) {
  const resolved = resolveVariant(variant);
  const resolvedLabel = label ?? extractLabel(children);
  return (
    <Pressable
      className={cn(VARIANT_CLASS[resolved], className)}
      style={({ pressed }) => [SIZE_STYLE[size], pressed && PRESSED_STYLE, style]}
      onPress={onPress}
      disabled={disabled}
      {...viewProps}
    >
      {resolvedLabel === undefined ? (
        children
      ) : (
        <Text className={LABEL_CLASS[resolved]}>{resolvedLabel}</Text>
      )}
    </Pressable>
  );
}

export { Button };
export type { ButtonProps, ButtonSize, ButtonVariant };
