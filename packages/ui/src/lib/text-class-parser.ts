import { isObject } from '@packrat/guards';
import colors from 'tailwindcss/colors';

// Matches expo-app/theme/colors.ts COLORS[colorScheme] shape.
type ThemeColors = {
  grey6: string;
  grey5: string;
  grey4: string;
  grey3: string;
  grey2: string;
  grey: string;
  yellow: string;
  green: string;
  background: string;
  foreground: string;
  root: string;
  card: string;
  destructive: string;
  primary: string;
};

type ParsedTextStyle = {
  fontWeight?:
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900';
  fontSize?: number;
  color?: string;
  textAlign?: 'left' | 'right' | 'center';
};

const FONT_WEIGHT: Record<string, ParsedTextStyle['fontWeight']> = {
  'font-thin': '100',
  'font-extralight': '200',
  'font-light': '300',
  'font-normal': 'normal',
  'font-medium': '500',
  'font-semibold': '600',
  'font-bold': 'bold',
  'font-extrabold': '800',
  'font-black': '900',
};

const FONT_SIZE: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
  'text-3xl': 30,
  'text-4xl': 36,
};

const TEXT_ALIGN: Record<string, ParsedTextStyle['textAlign']> = {
  'text-left': 'left',
  'text-right': 'right',
  'text-center': 'center',
};

// Semantic theme tokens (rely on the live-resolved `colors` from useColorScheme, not a hex constant).
const THEME_COLOR_KEY: Record<string, keyof ThemeColors> = {
  'text-foreground': 'foreground',
  'text-primary': 'primary',
  'text-muted-foreground': 'grey',
  'text-destructive': 'destructive',
};

// *-foreground tokens are white in both themes (see apps/expo/global.css) — not present in
// expo-app/theme/colors.ts's COLORS object, so resolved as a fixed value instead.
const FIXED_COLOR: Record<string, string> = {
  'text-primary-foreground': '#FFFFFF',
  'text-secondary-foreground': '#FFFFFF',
  'text-destructive-foreground': '#FFFFFF',
};

type TailwindPalette = typeof colors;

const TEXT_COLOR_CLASS = /^text-([a-z]+)-(\d{2,3})$/;

function resolveTailwindPaletteColor(className: string): string | undefined {
  const match = className.match(TEXT_COLOR_CLASS);
  if (!match) return undefined;
  const [, family, shade] = match;
  if (!family || !shade) return undefined;
  // safe-cast: `family` is a regex capture group (arbitrary string), not statically known to be
  // a real Tailwind color family — indexing widens it to the palette's key type on purpose;
  // the isObject guard below is what actually makes this safe at runtime.
  const palette = colors[family as keyof TailwindPalette];
  if (!palette || !isObject(palette)) return undefined;
  // safe-cast: same reasoning as above, but for `shade` against the now-narrowed palette object —
  // TS can't prove an arbitrary string key maps to `string`, only that the object shape allows it.
  return (palette as Record<string, string>)[shade];
}

// Classes that give Yoga an explicit sizing signal for the Host box (stretch/grow/fixed
// dimensions). When none of these are present, Host has nothing to size itself by and
// collapses to zero height — matchContents is needed so it sizes to its native content instead.
// The two are mutually exclusive: matchContents fights flex-1 (see button.tsx/text.tsx comments).
const SIZING_CLASS = /^(flex-1|flex-auto|flex-grow|self-stretch|w-|h-|min-w-|min-h-)/;

function hasExplicitSizing(tokens: string[]): boolean {
  return tokens.some((token) => SIZING_CLASS.test(token));
}

const WHITESPACE = /\s+/;

type HostMatchContents = boolean | { vertical?: boolean; horizontal?: boolean };

/**
 * For components with no textStyle escape hatch (e.g. Button) — matches both axes to content
 * when there's no explicit sizing class. A button should size to its label/icon by default,
 * not stretch to fill an arbitrary parent width.
 */
function shouldMatchContents(className: string | undefined): boolean {
  if (!className) return true;
  return !hasExplicitSizing(className.split(WHITESPACE).filter(Boolean));
}

/**
 * For Text. Two conflicting default needs, disambiguated by the caller's explicit `wrap` flag:
 * - `wrap: false` (default) — matches both axes to content, so short labels/badges/headings
 *   shrink-wrap to their own text width, same as the old NativeWindUI Text's default behavior.
 * - `wrap: true` — matches only the vertical axis, so the Host box keeps the parent's width
 *   constraint and paragraph/note text wraps at that width instead of overflowing unwrapped.
 * An explicit sizing class (flex-1, w-*, ...) always wins over either default.
 */
function textMatchContents({
  hostClassName,
  wrap,
}: {
  hostClassName: string | undefined;
  wrap: boolean;
}): HostMatchContents {
  const hasSizing = hostClassName
    ? hasExplicitSizing(hostClassName.split(WHITESPACE).filter(Boolean))
    : false;
  // An explicit sizing class always wins — Yoga sizes the box, nothing matches to content.
  if (hasSizing) return false;
  return wrap ? { vertical: true } : true;
}

/**
 * Splits a NativeWind className string into text-only styling (font weight/size/color/align —
 * applied to the @expo/ui Host's textStyle, since Host's className interop only reaches the
 * box, never the native-bridged text inside) and everything else (kept as className on Host).
 */
function splitTextClassName({
  className,
  themeColors,
  wrap,
}: {
  className: string | undefined;
  themeColors: ThemeColors;
  wrap: boolean;
}): {
  textStyle: ParsedTextStyle;
  hostClassName: string | undefined;
  matchContents: HostMatchContents;
  /** wrap:true with no explicit sizing class needs a fallback width — Host has nothing to wrap
   * text against otherwise, since the parent may not stretch it (e.g. `items-center`). */
  needsExplicitWidth: boolean;
} {
  if (!className) {
    return {
      textStyle: {},
      hostClassName: undefined,
      matchContents: textMatchContents({ hostClassName: undefined, wrap }),
      needsExplicitWidth: wrap,
    };
  }

  const textStyle: ParsedTextStyle = {};
  const hostTokens: string[] = [];

  for (const token of className.split(WHITESPACE).filter(Boolean)) {
    if (token in FONT_WEIGHT) {
      textStyle.fontWeight = FONT_WEIGHT[token];
    } else if (token in FONT_SIZE) {
      textStyle.fontSize = FONT_SIZE[token];
    } else if (token in TEXT_ALIGN) {
      textStyle.textAlign = TEXT_ALIGN[token];
    } else if (token in THEME_COLOR_KEY) {
      const themeKey = THEME_COLOR_KEY[token];
      if (themeKey) textStyle.color = themeColors[themeKey];
    } else if (token in FIXED_COLOR) {
      textStyle.color = FIXED_COLOR[token];
    } else {
      const paletteColor = resolveTailwindPaletteColor(token);
      if (paletteColor) {
        textStyle.color = paletteColor;
      } else {
        hostTokens.push(token);
      }
    }
  }

  const hostClassName = hostTokens.length > 0 ? hostTokens.join(' ') : undefined;
  return {
    textStyle,
    hostClassName,
    matchContents: textMatchContents({ hostClassName, wrap }),
    needsExplicitWidth: wrap && !hasExplicitSizing(hostTokens),
  };
}

export { shouldMatchContents, splitTextClassName };
export type { HostMatchContents, ParsedTextStyle };
