import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { splitTextClassName } from './lib/text-class-parser';

type TextVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'heading'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption1'
  | 'caption2';

type TextColor = 'primary' | 'secondary' | 'tertiary' | 'quarternary';

const VARIANT_FONT_SIZE: Record<TextVariant, number> = {
  largeTitle: 34,
  title1: 24,
  title2: 22,
  title3: 20,
  heading: 17,
  body: 17,
  callout: 16,
  subhead: 15,
  footnote: 13,
  caption1: 12,
  caption2: 11,
};

const VARIANT_LINE_HEIGHT: Partial<Record<TextVariant, number>> = {
  title2: 28,
  heading: 24,
  body: 24,
  subhead: 24,
  footnote: 20,
  caption2: 16,
};

const VARIANT_WEIGHT: Partial<Record<TextVariant, 'bold'>> = {
  heading: 'bold',
};

const COLOR_KEY: Record<TextColor, 'foreground' | 'grey' | 'grey2' | 'grey3'> = {
  primary: 'foreground',
  secondary: 'grey',
  tertiary: 'grey2',
  quarternary: 'grey3',
};

type TextProps = {
  children?: React.ReactNode;
  variant?: TextVariant;
  color?: TextColor;
  /** Overrides the resolved theme/variant color (e.g. a fixed brand/status hex). */
  textColor?: string;
  /** Escape hatch for arbitrary text styling not covered by variant/color/className. */
  textStyle?: StyleProp<TextStyle>;
  /**
   * @deprecated No longer does anything and can be deleted from call sites.
   *
   * This existed because the old `@expo/ui`-backed implementation rendered through `Host`, a
   * native bridge with no React Native-side intrinsic size: it could either shrink-wrap to its
   * text (overflowing a narrow parent) or stretch to its parent, never `min(content, parent)`
   * like real text. `wrap` picked between those. A plain RN `Text` just does the right thing, so
   * the flag is inert — kept only so the ~40 call sites that pass it still compile.
   */
  wrap?: boolean;
  className?: string;
  style?: StyleProp<TextStyle>;
} & Omit<RNTextProps, 'style' | 'children'>;

/**
 * A plain React Native `Text`, deliberately NOT `@expo/ui`'s Text.
 *
 * The `@expo/ui` version rendered through `Host` (a bridge to a native SwiftUI/Compose surface),
 * which caused a long tail of layout bugs on-device because `Host` has no RN-side intrinsic size:
 * centered headings rendered flush-left, `numberOfLines={2}` could never wrap, and prose
 * overflowed its container unless the call site remembered an explicit `wrap`. It also could not
 * render nested children (`children` was typed `string`), so inline links and styled segments —
 * the consent screen's Terms/Privacy links, the OTP screen's email — were silently deleted.
 *
 * Plain RN `Text` fixes all of that structurally: Yoga sizes it as `min(content, parent)`, nested
 * `<Text>` composes natively, and NativeWind applies `className` directly (including `dark:`
 * variants, opacity modifiers and arbitrary values, which the bespoke class parser could not).
 * `variant`/`color` remain as defaults that any conflicting `className` overrides.
 */
function Text({
  children,
  variant = 'body',
  color = 'primary',
  textColor,
  textStyle,
  wrap: _wrap,
  className,
  style,
  ...rest
}: TextProps) {
  const { colors } = useColorScheme();
  // NativeWind merges className-derived styles before the `style` prop, so anything put in
  // `style` would silently beat the call site's own classes. The parser is used here purely to
  // see *which* text properties `className` already sets, so the variant/color defaults only
  // fill in the gaps instead of overriding them.
  const { textStyle: fromClassName } = splitTextClassName({
    className,
    themeColors: colors,
    wrap: false,
    baseFontSize: VARIANT_FONT_SIZE[variant],
  });
  const defaults: TextStyle = {
    ...(fromClassName.fontSize === undefined && { fontSize: VARIANT_FONT_SIZE[variant] }),
    // The variant's line height is only meaningful for the variant's own font size. If className
    // resizes the text (e.g. `text-3xl` on a default `body`), keeping it would leave a line box
    // shorter than the glyphs and visibly clip their tops and bottoms — seen on the iOS auth
    // headline. Falling back to the platform's natural line height is correct there.
    ...(fromClassName.lineHeight === undefined &&
      fromClassName.fontSize === undefined && { lineHeight: VARIANT_LINE_HEIGHT[variant] }),
    ...(fromClassName.fontWeight === undefined && { fontWeight: VARIANT_WEIGHT[variant] }),
    ...((textColor !== undefined || fromClassName.color === undefined) && {
      color: textColor ?? colors[COLOR_KEY[color]],
    }),
  };
  return (
    <RNText className={className} style={[defaults, textStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}

export { Text };
export type { TextColor, TextProps, TextVariant };
