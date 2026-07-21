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
  const palette = (colors as TailwindPalette)[family as keyof TailwindPalette];
  if (!palette || typeof palette !== 'object') return undefined;
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

/** For components with no textStyle escape hatch (e.g. Button) — just the sizing detection. */
function shouldMatchContents(className: string | undefined): boolean {
  if (!className) return true;
  return !hasExplicitSizing(className.split(WHITESPACE).filter(Boolean));
}

/**
 * Splits a NativeWind className string into text-only styling (font weight/size/color/align —
 * applied to the @expo/ui Host's textStyle, since Host's className interop only reaches the
 * box, never the native-bridged text inside) and everything else (kept as className on Host).
 */
function splitTextClassName(
  className: string | undefined,
  themeColors: ThemeColors,
): { textStyle: ParsedTextStyle; hostClassName: string | undefined; matchContents: boolean } {
  if (!className) return { textStyle: {}, hostClassName: undefined, matchContents: true };

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
      textStyle.color = themeColors[THEME_COLOR_KEY[token]];
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

  return {
    textStyle,
    hostClassName: hostTokens.length > 0 ? hostTokens.join(' ') : undefined,
    matchContents: !hasExplicitSizing(hostTokens),
  };
}

export { shouldMatchContents, splitTextClassName };
export type { ParsedTextStyle };
