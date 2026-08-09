import { isString, toRecord } from '@packrat/guards';
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

/**
 * Total map over every `ButtonVariant`, legacy and current, so resolving one is a plain lookup with
 * no cast. `Record<ButtonVariant, ResolvedVariant>` makes TypeScript reject the file if a variant is
 * ever added without a resolution, which an `in`-check plus two casts could not do.
 */
const VARIANT_MAP: Record<ButtonVariant, ResolvedVariant> = {
  // legacy names, kept as distinct styles
  primary: 'filled',
  secondary: 'outlined',
  tonal: 'tonal',
  plain: 'text',
  // current names resolve to themselves
  filled: 'filled',
  outlined: 'outlined',
  text: 'text',
};

/**
 * The old cva size classes, kept as classes rather than an inline `style`.
 *
 * They were briefly a `ViewStyle` lookup applied through `style`, which silently did nothing:
 * NativeWind's `cssInterop` owns the `style` prop on a `className`'d component and drops the
 * function form (`style={({ pressed }) => [...]}`) that Pressable needs for press feedback, so
 * every size — including `icon`'s 40x40 — was discarded. On-device that left `size="icon"`
 * buttons at their glyph's intrinsic ~20dp and gave content-sized `md` buttons no horizontal
 * padding at all, so the rounded border cut into the label ("Add Item" on the pack detail screen).
 *
 * As classes they go through the same pipeline as the variants, and because `cn` is `twMerge` a
 * call site's own `px-*`/`h-*` still overrides them.
 */
const SIZE_CLASS: Record<ButtonSize, string> = {
  none: '',
  sm: 'py-1 px-2.5',
  md: 'py-2 px-3.5',
  lg: 'py-2.5 px-5',
  icon: 'h-10 w-10',
};

/**
 * Press feedback as a class, for the same reason the sizes are: it used to ride on the same
 * dropped `style={({ pressed }) => [...]}` array as SIZE_STYLE, so it could not have been
 * applied either. `active:` is NativeWind's binding for Pressable's pressed state; on-device a
 * held button measures 0.70x the released frame's mean brightness, and identical on release.
 */
const BASE_CLASS = 'flex-row items-center justify-center rounded-full active:opacity-70';

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
  return VARIANT_MAP[variant];
}

/**
 * The `Text` props that carry visual intent. Any one of them present means the call site styled its
 * own label, so `extractLabel` must not unwrap and repaint it.
 */
const STYLING_PROPS = Object.freeze([
  'className',
  'variant',
  'color',
  'textColor',
  'textStyle',
  'style',
] as const);

/**
 * Unwraps `<Button><Text>Save</Text></Button>` to the string `'Save'`, so an unstyled label can be
 * repainted with the button's own per-variant `LABEL_CLASS`.
 *
 * A `<Text>` that carries **its own styling props is deliberately left alone**. Unwrapping is
 * lossy — it keeps the string and throws the element away — so restyling a label the call site had
 * already styled silently reverses an explicit intent.
 *
 * The profile screen's sign-out button was exactly this bug. Its child looks like a ternary, but a
 * JSX ternary evaluates to a *single element* before React sees it, so `Children.toArray` returns
 * one child and every gate below passed: `<Text className="text-destructive">Log Out</Text>` was
 * flattened to `'Log Out'` and re-rendered with `filled`'s `text-primary-foreground` (#FFFFFF).
 * The call site's `className="bg-card"` also beats `bg-primary` under `twMerge`, so the pill was
 * white too — white-on-white, an empty rounded rectangle at the right size with no visible glyphs.
 * Bailing out here lets the call site's own `<Text>` render, in `destructive` red as intended.
 */
function extractLabel(children: ReactNode): string | undefined {
  const kids = Children.toArray(children);
  if (kids.length !== 1) return undefined;
  const only = kids[0];
  if (isString(only)) return only;
  if (isValidElement(only) && only.type === Text) {
    const props = toRecord(only.props);
    if (STYLING_PROPS.some((prop) => props[prop] !== undefined)) return undefined;
    return isString(props.children) ? props.children : undefined;
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
      className={cn(VARIANT_CLASS[resolved], SIZE_CLASS[size], className)}
      style={style}
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
