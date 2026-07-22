import type { UniversalTextStyle } from '@expo/ui';
import { Text as ExpoText, Host } from '@expo/ui';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import { Children, isValidElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { splitTextClassName } from './lib/text-class-parser';

cssInterop(Host, { className: 'style' });

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
  /** Escape hatch for arbitrary native text styling not covered by variant/color/className. */
  textStyle?: UniversalTextStyle;
  numberOfLines?: number;
  /**
   * Set for paragraph/note/dynamic-length text that should wrap at its container's width
   * (Host sizes only its height to content, keeping the parent's width constraint). Leave unset
   * (default) for labels, badges, and headings that should shrink-wrap to their own text width —
   * matching the old NativeWindUI Text's default behavior. Only matters when className has no
   * explicit sizing (flex-1, w-*, h-*, ...), which always wins over either default.
   */
  wrap?: boolean;
  /**
   * NativeWind classes. Font-weight/size, text-align, and text-color utilities (font-medium,
   * text-lg, text-center, text-muted-foreground, text-red-500, ...) are extracted and applied
   * to the native text itself — Host's className interop only reaches the box, never the
   * native-bridged text inside. Everything else (flex, margin, width, ...) stays on Host.
   */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function Text({
  children,
  variant = 'body',
  color = 'primary',
  textColor,
  textStyle,
  numberOfLines,
  wrap = false,
  className,
  style,
  testID,
}: TextProps) {
  const { colors } = useColorScheme();
  const {
    textStyle: classTextStyle,
    hostClassName,
    matchContents,
  } = splitTextClassName({ className, themeColors: colors, wrap });
  return (
    <Host matchContents={matchContents} className={hostClassName} style={style} testID={testID}>
      <ExpoText
        numberOfLines={numberOfLines}
        textStyle={{
          fontSize: VARIANT_FONT_SIZE[variant],
          lineHeight: VARIANT_LINE_HEIGHT[variant],
          fontWeight: VARIANT_WEIGHT[variant],
          color: textColor ?? colors[COLOR_KEY[color]],
          ...classTextStyle,
          ...textStyle,
        }}
      >
        {flattenToString(children)}
      </ExpoText>
    </Host>
  );
}

function flattenToString(children: React.ReactNode): string {
  return Children.toArray(children)
    .map((child) => (isValidElement(child) ? '' : String(child)))
    .join('');
}

export { Text };
export type { TextColor, TextProps, TextVariant };
